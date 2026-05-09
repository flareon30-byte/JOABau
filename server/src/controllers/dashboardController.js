const prisma = require('../prisma');
const { calculateGroupFinancials } = require('../utils/financialUtils');
const { getGlobalSupportDeficit } = require('../services/financialService');

// Helper: Calculate working days for a given month/year
const getWorkingDays = (year, month) => {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    let count = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) count++;
    }
    return count;
};

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
        // 1. Get User's Team
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

        const teamSize = user.team?._count?.members || 1;
        const teamId = user.teamId || 'no-team';

        // 2. Get Team Appointments (Calendar) + Individual History (Done work)
        const today = new Date();
        const appointments = await prisma.appointment.findMany({
            where: {
                OR: [
                    { assignedTeamId: teamId },
                    { 
                        address: { 
                            activationInfo: { 
                                performerIds: { has: userId } 
                            } 
                        } 
                    },
                    {
                        address: {
                            sopladoInfo: {
                                performerIds: { has: userId }
                            }
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
            bp: 0,
            ta: 0,
            sp: 0,
            mdu: 0,
            gk: 0,
            viviendas: 0
        };

        let regularEarnings = 0;
        let saturdayEarnings = 0;
        let regularActivations = 0;
        let saturdayActivations = 0;

        if (isBlower) {
            const soplados = await prisma.sopladoInfo.findMany({
                where: {
                    createdAt: { gte: startOfMonth, lte: endDate },
                    OR: [
                        { performerIds: { has: userId } },
                        { teamId: teamId || 'non-existent' }
                    ],
                    address: { project: { isDemo: req.isDemo || false } }
                }
            });
            performanceData = soplados.map(s => ({
                isSaturday: s.isSaturday,
                activationType: 'BP',
                createdAt: s.createdAt,
                basePrice: 0
            }));
            // Populate counts for blowers
            soplados.forEach(s => { 
                counts.viviendas++; 
                if (s.isSaturday) saturdayActivations++;
                else regularActivations++;
            });
        } else {
            performanceData = await prisma.activationInfo.findMany({
                where: {
                    createdAt: { gte: startOfMonth, lte: endDate },
                    OR: [
                        { performerIds: { has: userId } },
                        {
                            address: {
                                project: { isDemo: req.isDemo || false },
                                appointment: { assignedTeamId: teamId || 'non-existent' }
                            }
                        }
                    ]
                }
            });
            // Populate counts for installers
            performanceData.forEach(act => {
                const type = act.activationType || 'BP';
                if (type === 'BP' || type === 'BP_2_FAM') {
                    counts.bp += (type === 'BP_2_FAM' ? 2 : 1);
                } else if (type === 'SDU') {
                    counts.ta++;
                } else if (type === 'MDU') {
                    counts.mdu++;
                } else if (type === 'BR_MULTI') {
                    counts.bp++;
                }

                if (act.spInstalled > 0) counts.sp += act.spInstalled;
                if ((type !== 'SDU') && (act.taInstalled || (act.taCount && act.taCount > 0))) {
                    counts.ta += (act.taCount || 1);
                }
                if (type !== 'MDU' && act.mduInstalled) counts.mdu++;
                
                if (act.isSaturday) {
                    saturdayActivations++;
                } else {
                    regularActivations++;
                }
            });
        }



        // 4. Get Financial Config (Same logic as Payroll Controller for parity)
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
        
        // Fallback for UI robustness
        if (!fin) fin = {};
        // No longer need manual earnings loop here as we use statsFromLib below
        
        // 5. Get Simple Installations (Dynamic Catalog)
        const simpleData = await prisma.simpleInstallation.findMany({
            where: {
                createdAt: { gte: startOfMonth, lte: endDate },
                createdById: userId
            },
            include: {
                items: { include: { priceItem: true } }
            }
        });
        
        simpleData.forEach(gk => {
            let instBonusTotal = 0;
            gk.items.forEach(item => {
                const bonus = (item.bonusAtTime || 0) * (item.quantity || 1);
                instBonusTotal += bonus;
                
                // Counts by Name
                const itemName = item.priceItem?.name || 'Desconocido';
                counts[itemName] = (counts[itemName] || 0) + (item.quantity || 1);
            });

            const bonusToCredit = gk.items.length > 0 ? instBonusTotal : (gk.priceCharged || 0);
            
            counts.gk++;
            regularEarnings += bonusToCredit;
            regularActivations++;

            // Merge for unified calculation
            performanceData.push({
                isSaturday: gk.createdAt && new Date(gk.createdAt).getDay() === 6,
                activationType: 'GK',
                createdAt: gk.createdAt,
                basePrice: bonusToCredit,
                spPrice: 0, taPrice: 0, mduPrice: 0, repairPrice: 0
            });
        });

        // 6. Fetch User Dietas for individual logic
        const userDietasLogs = await prisma.dietaLog.findMany({
            where: {
                userId: userId,
                date: { gte: startOfMonth, lte: endDate }
            }
        });
        let myDietasPayOnly = 0;
        userDietasLogs.forEach(d => {
            let base = d.type === 'HOTEL' ? 28 : (d.type === 'CASA' ? 14 : 0);
            myDietasPayOnly += base;
        });

        // --- OVERHEAD CALCULATION (Global Deficit) ---
        let overheadToCover = 0;
        if (groupKey === 'installers') {
            overheadToCover = await getGlobalSupportDeficit(req.isDemo || false, startOfMonth, endDate);
        }

        const teamMembersCount = user.team?.members?.length || 1;

        const statsFromLib = calculateGroupFinancials(
            performanceData, 
            fin, 
            [user], // Individual mode for the technician
            overheadToCover / teamMembersCount, 
            getWorkingDays(startOfMonth.getFullYear(), startOfMonth.getMonth()), // Sync with payroll
            myDietasPayOnly,
            true, // isIndividualMode
            teamMembersCount, // userTeamSize
            userId // targetUserId
        );

        // PRIVACY: Only show 'earnings' if user is Admin, otherwise just show progress towards target
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.userRole);

         res.json({
             activeClientId: user.team?.activeClientCompanyId || user.activeClientCompanyId,
             appointments,
             stats: {
                 regularEarnings: isAdmin ? statsFromLib.totalRevenue - statsFromLib.saturdayPay : null,
                 saturdayEarnings: statsFromLib.saturdayPay,
                 regularActivations,
                 saturdayActivations,
                 counts,
                 // Money-based progress
                 totalRevenueGenerated: statsFromLib.totalRevenue,
                 targetRevenueToCover: statsFromLib.totalTargetRevenue,
                 moneyProgressPercent: statsFromLib.progressPercent,
                 accumulatedBonus: statsFromLib.bonusPool,
                // Legacy support for UI
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
