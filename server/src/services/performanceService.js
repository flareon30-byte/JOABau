const prisma = require('../prisma');
const { calculateGroupFinancials, getWorkingDays, getCycleDates } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('./financialService');

/**
 * Unified function to calculate performance for a specific user.
 * Cleaned up and stabilized for production.
 */
async function getUnifiedUserStats(userId, isDemo = false, customStartDate = null, customEndDate = null) {
    const today = new Date();
    let { start, end } = getCycleDates(today);

    if (customStartDate) start = new Date(customStartDate);
    if (customEndDate) end = new Date(customEndDate);

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

    const groupKey = user.role === 'BLOWER' ? 'blowers' : 'installers';
    const teamMembersCount = user.team?.members?.length || 1;

    // ONLY GLASFASER PLUS (ActivationInfo)
    // We look strictly at the creation date. Including updatedAt causes old activations
    // edited by BackOffice to be counted again and re-paid in the current cycle.
    const activations = await prisma.activationInfo.findMany({
        where: {
            createdAt: { gte: start, lte: end },
            performerIds: { has: userId },
            isDraft: false
        }
    });

    const userDietasLogs = await prisma.dietaLog.findMany({
        where: {
            userId: userId,
            date: { gte: start, lte: end }
        }
    });
    let myDietasPayOnly = 0;
    userDietasLogs.forEach(d => {
        let base = d.type === 'HOTEL' ? 28 : (d.type === 'CASA' ? 14 : 0);
        if (d.isSaturday) myDietasPayOnly += base;
        else myDietasPayOnly += (d.amount || 0);
    });

    const overheadToCover = await getGlobalSupportDeficit(isDemo, start, end);

    const systemSettings = await prisma.systemSettings.findFirst({
        where: { isDemo: isDemo }
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
        overheadToCover / teamMembersCount, // Divide the team's overhead share by number of members
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
