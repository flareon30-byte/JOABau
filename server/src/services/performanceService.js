const prisma = require('../prisma');
const { calculateGroupFinancials, getWorkingDays, getCycleDates } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('./financialService');

/**
 * Unified function to calculate performance for a specific user.
 * Adjusted to show the current active production regardless of strict month boundaries
 * if the current cycle is still empty.
 */
async function getUnifiedUserStats(userId, isDemo = false) {
    const today = new Date();
    let { start, end } = getCycleDates(today);

    // If we are in the first days of a cycle and there's no data, 
    // we automatically show the PREVIOUS cycle so the user doesn't see a 0% 
    // until they start working in the new one.
    
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

    // 1. Try to fetch activations for CURRENT cycle
    let activations = await prisma.activationInfo.findMany({
        where: {
            createdAt: { gte: start, lte: end },
            performerIds: { has: userId }
        }
    });

    // 2. STICKY PROGRESS: If current cycle is empty, fetch the previous one 
    // so the dashboard always shows the latest relevant performance (the 59% / 100%)
    if (activations.length === 0) {
        // Look back 30 days more to catch the early April activations Jane is talking about
        const fallbackStart = new Date(start);
        fallbackStart.setDate(fallbackStart.getDate() - 30);
        
        activations = await prisma.activationInfo.findMany({
            where: {
                createdAt: { gte: fallbackStart, lte: end },
                performerIds: { has: userId }
            }
        });
        
        // Update cycle dates for the response if we used fallback
        start = fallbackStart;
    }

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

module.exports = { getUnifiedUserStats };
