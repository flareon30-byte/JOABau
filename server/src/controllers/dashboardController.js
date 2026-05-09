const prisma = require('../prisma');
const { calculateGroupFinancials, getWorkingDays } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('../services/financialService');
const { getUnifiedUserStats, getCycleDates } = require('../services/performanceService');

exports.getDashboardStats = async (req, res) => {
    try {
        const [pendingCount, assignedCount, completedActivationsCount, simpleCount] = await Promise.all([
            prisma.address.count({
                where: {
                    sopladoStatus: 'OK',
                    project: { isDemo: req.isDemo || false },
                    orderStatus: { notIn: ['CERRADA', 'DERIVADA'] },
                    AND: [{ clientName: { not: { startsWith: '***' } } }],
                    OR: [
                        { appointment: { is: null } },
                        { appointment: { status: 'PENDIENTE' } }
                    ]
                }
            }),
            prisma.appointment.count({
                where: {
                    status: 'CITADO',
                    address: { project: { isDemo: req.isDemo || false } }
                }
            }),
            prisma.activationInfo.count({
                where: { address: { project: { isDemo: req.isDemo || false } } }
            }),
            prisma.simpleInstallation.count({
                where: { address: { project: { isDemo: req.isDemo || false } } }
            })
        ]);

        res.json({
            pendingAppointments: pendingCount,
            assignedAppointments: assignedCount,
            completedActivations: completedActivationsCount + simpleCount,
            simpleCount: simpleCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

exports.getPayrollStats = async (req, res) => {
    try {
        const { start: startDate, end: endDate } = getCycleDates();

        const activations = await prisma.activationInfo.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            include: {
                address: {
                    include: {
                        appointment: {
                            include: {
                                assignedTeam: { include: { members: true } }
                            }
                        }
                    }
                }
            }
        });

        const teamStats = {};
        const techStats = {};
        const allUsers = await prisma.user.findMany({
            where: { id: { in: [...new Set(activations.flatMap(a => a.performerIds || []))] } },
            select: { id: true, username: true }
        });
        const userMap = new Map(allUsers.map(u => [u.id, u.username]));

        activations.forEach(act => {
            const performers = act.performerIds || [];
            if (performers.length === 0) return;
            const actTotal = (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);
            const share = actTotal / performers.length;

            const team = act.address.appointment?.assignedTeam;
            if (team) {
                if (!teamStats[team.id]) teamStats[team.id] = { id: team.id, name: team.name, earnings: 0, activations: 0 };
                teamStats[team.id].earnings += actTotal;
                teamStats[team.id].activations += 1;
            } else {
                const virtualTeamId = 'virtual-' + [...performers].sort().join('-');
                const virtualTeamName = 'Histórico: ' + performers.map(id => userMap.get(id) || 'Desconocido').join(' & ');
                if (!teamStats[virtualTeamId]) teamStats[virtualTeamId] = { id: virtualTeamId, name: virtualTeamName, earnings: 0, activations: 0 };
                teamStats[virtualTeamId].earnings += actTotal;
                teamStats[virtualTeamId].activations += 1;
            }

            performers.forEach(pid => {
                if (!techStats[pid]) techStats[pid] = { id: pid, name: userMap.get(pid) || 'Desconocido', earnings: 0, activations: 0 };
                techStats[pid].earnings += share;
                techStats[pid].activations += 1;
            });
        });

        res.json({
            period: { start: startDate, end: endDate },
            teams: Object.values(teamStats),
            technicians: Object.values(techStats).sort((a, b) => b.earnings - a.earnings)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching payroll stats' });
    }
};

exports.getActivatorDashboard = async (req, res) => {
    try {
        const unified = await getUnifiedUserStats(req.userId, req.isDemo || false);
        if (!unified) return res.status(404).json({ message: 'User not found' });

        const { user, stats, cycle } = unified;
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.userRole);

        const appointments = await prisma.appointment.findMany({
            where: {
                OR: [
                    { assignedTeamId: user.teamId || 'no-team' },
                    { address: { activationInfo: { performerIds: { has: user.id } } } },
                    { address: { sopladoInfo: { performerIds: { has: user.id } } } }
                ]
            },
            include: {
                address: { include: { project: true, activationInfo: true, sopladoInfo: true } }
            },
            orderBy: { assignedDate: 'asc' }
        });

        res.json({
            activeClientId: user.team?.activeClientCompanyId || user.activeClientCompanyId,
            appointments,
            stats: {
                regularEarnings: isAdmin ? stats.totalRevenue - stats.saturdayPay : null,
                saturdayEarnings: stats.saturdayPay,
                regularActivations: stats.counts.bp + stats.counts.ta + stats.counts.mdu,
                saturdayActivations: stats.counts.saturday,
                counts: stats.counts,
                totalRevenueGenerated: stats.totalRevenue,
                targetRevenueToCover: stats.totalTargetRevenue,
                moneyProgressPercent: stats.progressPercent,
                accumulatedBonus: stats.bonusPool,
                breakEvenUnits: stats.bonusThresholdUnits,
                isBonusMode: stats.progressPercent >= 100,
                role: req.userRole
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching activator dashboard' });
    }
};
