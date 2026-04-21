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

            // 1. Try original team from appointment
            const team = act.address.appointment?.assignedTeam;
            
            if (team) {
                // Happy path: Original team exists
                if (!teamStats[team.id]) {
                    teamStats[team.id] = { id: team.id, name: team.name, earnings: 0, activations: 0 };
                }
                teamStats[team.id].earnings += actTotal;
                teamStats[team.id].activations += 1;
            } else {
                // FALLBACK: The "Real Team" was deleted. 
                // We create a Virtual Team based on the performers' names so it's only counted ONCE.
                const virtualTeamId = 'virtual-' + [...performers].sort().join('-');
                const virtualTeamName = 'Histórico: ' + performers.map(id => userMap.get(id) || 'Desconocido').join(' & ');

                if (!teamStats[virtualTeamId]) {
                    teamStats[virtualTeamId] = { id: virtualTeamId, name: virtualTeamName, earnings: 0, activations: 0 };
                }
                teamStats[virtualTeamId].earnings += actTotal;
                teamStats[virtualTeamId].activations += 1;
            }
        });

        res.json({
            period: { month: currentMonth, year: currentYear },
            teams: Object.values(teamStats)
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

        let performanceData = [];
        const isBlower = req.userRole === 'BLOWER';

        if (isBlower) {
            // Fetch SopladoInfo for blowers
            performanceData = await prisma.sopladoInfo.findMany({
                where: {
                    createdAt: {
                        gte: startOfMonth,
                        lte: endDate
                    },
                    OR: [
                        { performerIds: { has: userId } },
                        { teamId: teamId }
                    ]
                }
            });
        } else {
            // Fetch ActivationInfo for activators/others (include work explicitly performed by this user)
            performanceData = await prisma.activationInfo.findMany({
                where: {
                    createdAt: {
                        gte: startOfMonth,
                        lte: endDate
                    },
                    OR: [
                        { performerIds: { has: userId } },
                        {
                            address: {
                                project: { isDemo: req.isDemo || false },
                                appointment: { assignedTeamId: teamId }
                            }
                        }
                    ]
                }
            });
        }

        let regularEarnings = 0;
        let saturdayEarnings = 0;
        let regularActivations = 0;
        let saturdayActivations = 0;

        // Production Counts
        const counts = {
            bp: 0,
            ta: 0,
            sp: 0,
            mdu: 0,
            gk: 0, // Added G&K count
            viviendas: 0 // New field for blowers
        };

        // 4. Get Financial Config (Same logic as Payroll Controller for parity)
        const systemSettings = await prisma.systemSettings.findFirst({
            where: { isDemo: req.isDemo || false }
        }) || { financials: {} };

        const groupKey = isBlower ? 'blowers' : 'installers';
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

        if (isBlower) {
            performanceData.forEach(sop => {
                const totalOnRecord = (fin.pricePerUnit || 10); // Price per dwelling blown
                const saturdaysPrice = (fin.pricePerSaturdayUnit || fin.pricePerUnit || 15);

                if (sop.isSaturday) {
                    saturdayEarnings += saturdaysPrice;
                    saturdayActivations++;
                } else {
                    regularEarnings += totalOnRecord;
                    regularActivations++;
                }
                counts.viviendas++;
            });
        } else {
            performanceData.forEach(act => {
                const type = act.activationType || 'BP';

                // 1. Determine Base Type for counts
                if (type === 'BP' || type === 'BP_2_FAM') {
                    counts.bp += (type === 'BP_2_FAM' ? 2 : 1);
                } else if (type === 'SDU') {
                    counts.ta++;
                } else if (type === 'MDU') {
                    counts.mdu++;
                } else if (type === 'BR_MULTI') {
                    counts.bp++;
                }

                // 2. Add Extras
                if (act.spInstalled > 0) {
                    counts.sp += act.spInstalled;
                }
                if ((type !== 'SDU') && (act.taInstalled || (act.taCount && act.taCount > 0))) {
                    counts.ta += (act.taCount || 1);
                }
                if (type !== 'MDU' && act.mduInstalled) {
                    counts.mdu++;
                }

                // 3. Financial Calculation (Sum of all prices on this record)
                const totalOnRecord = (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);

                // 4. Split by Saturday / Regular
                if (act.isSaturday) {
                    saturdayEarnings += totalOnRecord;
                    saturdayActivations++;
                } else {
                    regularEarnings += totalOnRecord;
                    regularActivations++;
                }
            });

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
                    
                    // NEW: Dynamic Counts by Name (not just department)
                    const itemName = item.priceItem?.name || 'Desconocido';
                    counts[itemName] = (counts[itemName] || 0) + (item.quantity || 1);
                });

                // If no items, fallback to old priceCharged field (legacy support)
                const bonusToCredit = gk.items.length > 0 ? instBonusTotal : (gk.priceCharged || 0);
                
                counts.gk++;
                regularEarnings += bonusToCredit;
                regularActivations++;
            });
        }

        // --- OVERHEAD CALCULATION (Global Deficit) ---
        let overheadToCover = 0;
        if (groupKey === 'installers') {
            overheadToCover = await getGlobalSupportDeficit(req.isDemo || false);
        }

        const statsFromLib = calculateGroupFinancials(
            performanceData, 
            fin, 
            user.team?.members || [user], 
            overheadToCover,
            getWorkingDays(today.getFullYear(), today.getMonth()) // Sync: Pass exact working days
        );

        // PRIVACY: Only show 'earnings' if user is Admin, otherwise just show progress towards target
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(req.userRole);

        const teamSizeInner = user.team?.members?.length || teamSize;
 
         res.json({
             activeClientId: user.team?.activeClientCompanyId || user.activeClientCompanyId,
             appointments,
             stats: {
                 regularEarnings: isAdmin ? statsFromLib.totalRevenue - statsFromLib.saturdayPay : null,
                 saturdayEarnings: statsFromLib.saturdayPay / teamSizeInner,
                 regularActivations,
                 saturdayActivations,
                 counts,
                 // Money-based progress
                 totalRevenueGenerated: statsFromLib.totalRevenue / teamSizeInner,
                 targetRevenueToCover: statsFromLib.totalTargetRevenue / teamSizeInner,
                 moneyProgressPercent: statsFromLib.progressPercent,
                 accumulatedBonus: statsFromLib.bonusPool / teamSizeInner,
                // Legacy support for UI
                breakEvenUnits: Math.ceil(statsFromLib.bonusThresholdUnits / teamSize),
                isBonusMode: statsFromLib.progressPercent >= 100,
                role: req.userRole
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching activator dashboard' });
    }
};
