const prisma = require('../prisma');
const { calculateGroupFinancials, getWorkingDays } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('./financialService');

/**
 * Shared helper to get cycle dates (21st to 20th)
 */
function getCycleDates(dateInput = new Date()) {
    let date = new Date(dateInput);
    let start, end;
    if (date.getDate() >= 21) {
        start = new Date(date.getFullYear(), date.getMonth(), 21);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 20, 23, 59, 59, 999);
    } else {
        start = new Date(date.getFullYear(), date.getMonth() - 1, 21);
        end = new Date(date.getFullYear(), date.getMonth(), 20, 23, 59, 59, 999);
    }
    return { start, end };
}

/**
 * Unified function to calculate performance for a specific user in a cycle.
 */
async function getUnifiedUserStats(userId, isDemo = false) {
    const today = new Date();
    const { start, end } = getCycleDates(today);

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

    const activations = await prisma.activationInfo.findMany({
        where: {
            createdAt: { gte: start, lte: end },
            performerIds: { has: userId }
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

module.exports = { getUnifiedUserStats, getCycleDates };
