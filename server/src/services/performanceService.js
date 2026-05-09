const prisma = require('../prisma');
const { calculateGroupFinancials, getWorkingDays, getCycleDates } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('./financialService');

/**
 * Unified function to calculate performance for a specific user in a cycle.
 */
async function getUnifiedUserStats(userId, isDemo = false) {
    const today = new Date();
    let { start, end } = getCycleDates(today);

    // SPECIAL CASE FOR DEMO: If there is no data in the current cycle, 
    // we look at everything for that user to make the demo look populated.
    // In production, this only looks at the 21-20 cycle.
    let dateFilter = { gte: start, lte: end };
    
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            activeClientCompany: true,
            team: {
                include: {
                    members: true,
                    activeClientCompany: true
                }
            }
        }
    });

    if (!user) return null;

    // Check if user is in a Demo project or if we should force wide range
    const isUserInDemo = user.team?.activeClientCompany?.isDemo || user.activeClientCompany?.isDemo || isDemo;

    if (isUserInDemo) {
        // For Demo, we show EVERYTHING so the bars are full (100% / 59%)
        dateFilter = { gte: new Date(2000, 0, 1), lte: new Date(2100, 0, 1) };
    }

    const groupKey = user.role === 'BLOWER' ? 'blowers' : 'installers';
    const teamMembersCount = user.team?.members?.length || 1;

    // ONLY REAL ACTIVATIONS
    const activations = await prisma.activationInfo.findMany({
        where: {
            createdAt: dateFilter,
            performerIds: { has: userId }
        }
    });

    const userDietasLogs = await prisma.dietaLog.findMany({
        where: {
            userId: userId,
            date: dateFilter
        }
    });
    let myDietasPayOnly = 0;
    userDietasLogs.forEach(d => {
        let base = d.type === 'HOTEL' ? 28 : (d.type === 'CASA' ? 14 : 0);
        if (d.isSaturday) myDietasPayOnly += base;
        else myDietasPayOnly += (d.amount || 0);
    });

    const overheadToCover = await getGlobalSupportDeficit(isUserInDemo, start, end);

    const systemSettings = await prisma.systemSettings.findFirst({
        where: { isDemo: isUserInDemo }
    }) || { financials: {} };

    let financialConfig = null;
    if (user.team?.activeClientCompany?.settings) {
        financialConfig = user.team.activeClientCompany.settings[groupKey];
    } else if (user.activeClientCompany?.settings) {
        financialConfig = user.activeClientCompany.settings[groupKey];
    }
    if (!financialConfig && systemSettings.financials) {
        financialConfig = systemSettings.financials[groupKey];
    }
    financialConfig = financialConfig || {};

    const stats = calculateGroupFinancials(
        activations,
        financialConfig,
        [user],
        overheadToCover / teamMembersCount,
        getWorkingDays(end.getFullYear(), end.getMonth()),
        myDietasPayOnly,
        true, 
        teamMembersCount,
        userId
    );

    return {
        user,
        cycle: { start, end },
        stats,
        activations
    };
}

module.exports = { getUnifiedUserStats };
