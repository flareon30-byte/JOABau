const prisma = require('../prisma');
const { calculateGroupFinancials, getWorkingDays, getCycleDates } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('../services/financialService');
const { getUnifiedUserStats } = require('../services/performanceService');

exports.getDashboardStats = async (req, res) => {
    try {
        const [pendingCount, assignedCount, completedActivationsCount] = await Promise.all([
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
            })
        ]);

        res.json({
            pendingAppointments: pendingCount,
            assignedAppointments: assignedCount,
            completedActivations: completedActivationsCount,
            simpleCount: 0 // G&K EXTIRPATED
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

exports.getPayrollStats = async (req, res) => {
    try {
        let startDate, endDate;
        if (req.query.startDate && req.query.endDate) {
            startDate = new Date(req.query.startDate);
            // Ensure endDate covers the whole day
            endDate = new Date(req.query.endDate);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const dates = getCycleDates();
            startDate = dates.start;
            endDate = dates.end;
        }

        // ONLY REAL ACTIVATIONS (Glasfaser Plus)
        const activations = await prisma.activationInfo.findMany({
            where: {
                OR: [
                    { createdAt: { gte: startDate, lte: endDate } },
                    { updatedAt: { gte: startDate, lte: endDate } }
                ]
            },
            include: {
                address: {
                    include: {
                        project: true,
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
        
        const performerIds = [...new Set(activations.flatMap(a => a.performerIds || []))];
        
        // Use the unified stats for each technician to get accurate data
        for (const pid of performerIds) {
            try {
                const unified = await getUnifiedUserStats(pid, req.isDemo || false);
                if (unified) {
                    const { stats, user } = unified;
                    techStats[pid] = {
                        id: pid,
                        name: user.username,
                        earnings: stats.totalRevenue,
                        target: stats.totalTargetRevenue,
                        progress: stats.progressPercent,
                        activations: stats.counts.bp + stats.counts.ta + stats.counts.mdu,
                        teamId: user.teamId,
                        teamName: user.team?.name || 'Individual'
                    };

                    const tId = user.teamId || ('virtual-' + pid);
                    const tName = user.team?.name || ('Histórico: ' + user.username);

                    if (!teamStats[tId]) {
                        teamStats[tId] = { id: tId, name: tName, earnings: 0, target: 0, activations: 0 };
                    }
                    teamStats[tId].earnings += stats.totalRevenue;
                    teamStats[tId].target += stats.totalTargetRevenue;
                    teamStats[tId].activations += techStats[pid].activations;
                }
            } catch (err) {
                console.error(`Error processing tech ${pid}:`, err);
            }
        }

        res.json({
            period: { start: startDate, end: endDate },
            teams: Object.values(teamStats).map(t => ({
                ...t,
                progress: t.target > 0 ? Math.min(100, (t.earnings / t.target) * 100) : 100
            })),
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
                AND: [
                    {
                        OR: [
                            { assignedTeamId: null },
                            { assignedTeamId: user.teamId || 'no-team' }
                        ]
                    },
                    {
                        OR: [
                            { assignedTeamId: user.teamId || 'no-team' },
                            { address: { activationInfo: { performerIds: { has: user.id } } } },
                            { address: { sopladoInfo: { performerIds: { has: user.id } } } }
                        ]
                    }
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
