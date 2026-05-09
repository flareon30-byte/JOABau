const prisma = require('../prisma');
const { calculateGroupFinancials, getWorkingDays } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('../services/financialService');

exports.getDashboardStats = async (req, res) => {
    try {
        const [pendingCount, assignedCount, completedActivationsCount, simpleCount] = await Promise.all([
            // Pending: Soplado OK but no appointment or pending appointment
            prisma.address.count({
                where: {
                    sopladoStatus: 'OK',
                    project: { isDemo: req.isDemo || false }, // Filter by Demo
                    orderStatus: { notIn: ['CERRADA', 'DERIVADA'] },
                    AND: [
                        { clientName: { not: { startsWith: '***' } } }
                    ],
                    OR: [
                        { appointment: { is: null } },
                        { appointment: { status: 'PENDIENTE' } }
                    ]
                }
            }),
            // Assigned: Appointment status CITADO
            prisma.appointment.count({
                where: {
                    status: 'CITADO',
                    address: { project: { isDemo: req.isDemo || false } }
                }
            }),
            // Completed: ActivationInfo exists
            prisma.activationInfo.count({
                where: {
                    address: { project: { isDemo: req.isDemo || false } }
                }
            }),
            // Simple: G&K records
            prisma.simpleInstallation.count({
                where: {
                    address: { project: { isDemo: req.isDemo || false } }
                }
            })
        ]);

        res.json({
            pendingAppointments: pendingCount,
            assignedAppointments: assignedCount,
            completedActivations: completedActivationsCount + simpleCount, // handle multiple sources
            simpleCount: simpleCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

exports.getPayrollStats = async (req, res) => {
    const { month, year } = req.query;
    const date = new Date();
    const currentMonth = month ? parseInt(month) : date.getMonth() + 1;
    const currentYear = year ? parseInt(year) : date.getFullYear();

    try {
        // Get all activations for the specified month/year
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0); // Last day of month

        const activations = await prisma.activationInfo.findMany({
            where: {
                createdAt: {
                    gte: startDate,
                    lte: endDate
                }
            },
            include: {
                address: {
                    include: {
                        appointment: {
                            include: {
                                assignedTeam: {
                                    include: { members: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Aggregate stats using Unique Attribution logic (No duplication)
        const teamStats = {};
        const techStats = {};

        // To identify performers quickly
        const allUsers = await prisma.user.findMany({
            where: { id: { in: [...new Set(activations.flatMap(a => a.performerIds || []))] } },
            select: { id: true, username: true }
        });
        const userMap = new Map(allUsers.map(u => [u.id, u.username]));

        activations.forEach(act => {
            const performers = act.performerIds || [];
            if (performers.length === 0) return;

            const actTotal = (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);
            
            // Shared amount per performer (Unique Attribution)
            const share = actTotal / performers.length;

            // 1. Team Aggregation
            const team = act.address.appointment?.assignedTeam;
            if (team) {
                if (!teamStats[team.id]) {
                    teamStats[team.id] = { id: team.id, name: team.name, earnings: 0, activations: 0 };
                }
                teamStats[team.id].earnings += actTotal;
                teamStats[team.id].activations += 1;
            } else {
                const virtualTeamId = 'virtual-' + [...performers].sort().join('-');
                const virtualTeamName = 'Histórico: ' + performers.map(id => userMap.get(id) || 'Desconocido').join(' & ');

                if (!teamStats[virtualTeamId]) {
                    teamStats[virtualTeamId] = { id: virtualTeamId, name: virtualTeamName, earnings: 0, activations: 0 };
                }
                teamStats[virtualTeamId].earnings += actTotal;
                teamStats[virtualTeamId].activations += 1;
            }

            // 2. Individual Technician Aggregation
            performers.forEach(pid => {
                if (!techStats[pid]) {
                    techStats[pid] = { id: pid, name: userMap.get(pid) || 'Desconocido', earnings: 0, activations: 0 };
                }
                techStats[pid].earnings += share; // Each performer gets a share for the bar progress
                techStats[pid].activations += 1;
            });
        });

        res.json({
            period: { month: currentMonth, year: currentYear },
            teams: Object.values(teamStats),
            technicians: Object.values(techStats).sort((a, b) => b.earnings - a.earnings)
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching payroll stats' });
    }
};

exports.getActivatorDashboard = async (req, res) => {
    const userId = req.userId;

    try {
        // 1. Get User
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

        const teamId = user.teamId || 'no-team';

        // 2. Get Team Appointments (Calendar) + Individual History (Done work)
        const today = new Date();
        const appointments = await prisma.appointment.findMany({
            where: {
                OR: [
                    { assignedTeamId: teamId },
                    { 
                        address: { 
                            activationInfo: { performerIds: { has: userId } } 
                        } 
                    },
                    {
                        address: {
                            sopladoInfo: { performerIds: { has: userId } }
                        }
                    }
                ]
            },
            include: {
                address: {
                    include: {
                        project: true,
                        activationInfo: true,
                        sopladoInfo: true
                    }
                }
            },
            orderBy: { assignedDate: 'asc' }
        });

        // 3. Get Performance Stats (Uses JOA Cycle 21-20)
        const { getCycleDates } = require('./payrollController');
        const { start: startOfMonth, end: endDate } = getCycleDates(today);
        const isBlower = req.userRole === 'BLOWER';
        const groupKey = isBlower ? 'blowers' : 'installers';

        let performanceData = [];
        const counts = {
            bp: 0, ta: 0, sp: 0, mdu: 0, gk: 0, viviendas: 0
        };

        let regularActivations = 0;
        let saturdayActivations = 0;

        if (isBlower) {
            const soplados = await prisma.sopladoInfo.findMany({
                where: {
                    createdAt: { gte: startOfMonth, lte: endDate },
                    performerIds: { has: userId },
                    address: { project: { isDemo: req.isDemo || false } }
                }
            });
            performanceData = soplados.map(s => ({
                isSaturday: s.isSaturday,
                activationType: 'BP',
                createdAt: s.createdAt,
                basePrice: 0,
                performerIds: s.performerIds
            }));
            
            // Populate weighted counts for blowers
            soplados.forEach(s => { 
                const weight = s.performerIds?.length > 0 ? (1 / s.performerIds.length) : 1;
                counts.viviendas += weight; 
                if (s.isSaturday) saturdayActivations += weight;
                else regularActivations += weight;
            });
        } else {
            // 1. Fetch Activations where this user is a performer (Strictly Individual)
            const activations = await prisma.activationInfo.findMany({
                where: {
                    createdAt: { gte: startOfMonth, lte: endDate },
                    performerIds: { has: userId }
                }
            });

            performanceData = [...activations];

            performanceData = [...activations];
        }

        // 4. Get Financial Config
        const systemSettings = await prisma.systemSettings.findFirst({
            where: { isDemo: req.isDemo || false }
        }) || { financials: {} };

        let fin = null;
        if (user.team?.activeClientCompany?.settings) {
            fin = user.team.activeClientCompany.settings[groupKey];
        } else if (user.activeClientCompany?.settings) {
            fin = user.activeClientCompany.settings[groupKey];
        }

        if (!fin && systemSettings.financials) {
            fin = systemSettings.financials[groupKey];
        }
        if (!fin) fin = {};

        // 6. Fetch User Dietas
        const userDietasLogs = await prisma.dietaLog.findMany({
            where: {
                userId: userId,
                date: { gte: startOfMonth, lte: endDate }
            }
        });
        let myDietasPayOnly = 0;
        userDietasLogs.forEach(d => {
            let base = d.type === 'HOTEL' ? 28 : (d.type === 'CASA' ? 14 : 0);
            if (d.isSaturday) {
                myDietasPayOnly += base; // Base only for Saturday cost in stats
            } else {
                myDietasPayOnly += d.amount; // Actual amount for regular days
            }
        });

        // --- OVERHEAD CALCULATION ---
        let overheadToCover = 0;
        if (groupKey === 'installers') {
            overheadToCover = await getGlobalSupportDeficit(req.isDemo || false, startOfMonth, endDate);
        }

        const teamMembersCount = user.team?.members?.length || 1;


        const statsFromLib = calculateGroupFinancials(
            performanceData, 
            fin, 
            [user], 
            overheadToCover / teamMembersCount, 
            getWorkingDays(endDate.getFullYear(), endDate.getMonth()), 
            myDietasPayOnly,
            true, // isIndividualMode
            teamMembersCount, 
            userId 
        );

        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.userRole);

         res.json({
             activeClientId: user.team?.activeClientCompanyId || user.activeClientCompanyId,
             appointments,
             stats: {
                 regularEarnings: isAdmin ? statsFromLib.totalRevenue - statsFromLib.saturdayPay : null,
                 saturdayEarnings: statsFromLib.saturdayPay,
                 regularActivations: statsFromLib.counts.bp + statsFromLib.counts.ta + statsFromLib.counts.mdu, // Summary of production
                 saturdayActivations: statsFromLib.counts.saturday,
                 counts: statsFromLib.counts,
                 totalRevenueGenerated: statsFromLib.totalRevenue,
                 targetRevenueToCover: statsFromLib.totalTargetRevenue,
                 moneyProgressPercent: statsFromLib.progressPercent,
                 accumulatedBonus: statsFromLib.bonusPool,
                 breakEvenUnits: statsFromLib.bonusThresholdUnits,
                 isBonusMode: statsFromLib.progressPercent >= 100,
                 role: req.userRole
             }
         });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching activator dashboard' });
    }
};
