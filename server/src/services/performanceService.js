const prisma = require('../prisma');
const { calculateGroupFinancials, getWorkingDays, getCycleDates } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('./financialService');

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

    // FETCH BOTH: Regular Activations AND Simple Installations (G&K)
    const [activations, simpleActivations] = await Promise.all([
        prisma.activationInfo.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                performerIds: { has: userId }
            }
        }),
        prisma.simpleInstallation.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                performerIds: { has: userId }
            }
        })
    ]);

    // Merge them
    const allActs = [
        ...activations,
        ...simpleActivations.map(s => ({
            ...s,
            activationType: 'BP'
        }))
    ];

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
        allActs,
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
        activations: allActs
    };
}

module.exports = { getUnifiedUserStats };
