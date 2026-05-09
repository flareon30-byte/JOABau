const prisma = require('../prisma');
const { calculateGroupFinancials, getWorkingDays } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('../services/financialService');
const { getCycleDates } = require('./payrollController');

/**
 * Unified function to calculate performance for a specific user in a cycle.
 * This ensures Dashboard and Payroll always show identical numbers.
 */
async function getUnifiedUserStats(userId, isDemo = false) {
    const today = new Date();
    const { start, end } = getCycleDates(today);

    // 1. Fetch User with all relations
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

    // 2. Fetch Activations (Weighted attribution)
    const activations = await prisma.activationInfo.findMany({
        where: {
            createdAt: { gte: start, lte: end },
            performerIds: { has: userId }
        }
    });

    // 3. Fetch Dietas
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

    // 4. Fetch Global Overhead
    const overheadToCover = await getGlobalSupportDeficit(isDemo, start, end);

    // 5. Fetch Financial Config (Hierarchy: Team -> User -> System)
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

    // 6. Calculate via core engine
    const stats = calculateGroupFinancials(
        activations,
        financialConfig,
        [user],
        overheadToCover / teamMembersCount,
        getWorkingDays(end.getFullYear(), end.getMonth()),
        myDietasPayOnly,
        true, // isIndividualMode
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
