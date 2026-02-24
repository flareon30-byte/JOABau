const prisma = require('../prisma');

exports.getDashboardStats = async (req, res) => {
    try {
        const [pendingCount, assignedCount, completedCount] = await Promise.all([
            // Pending: Soplado OK but no appointment or pending appointment
            prisma.address.count({
                where: {
                    sopladoStatus: 'OK',
                    project: { isDemo: req.isDemo || false }, // Filter by Demo
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
            })
        ]);

        res.json({
            pendingAppointments: pendingCount,
            assignedAppointments: assignedCount,
            completedActivations: completedCount
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

        // Aggregate points by Team and User
        const teamStats = {};
        const userStats = {};

        activations.forEach(act => {
            const team = act.address.appointment?.assignedTeam;
            if (team) {
                // Team Stats
                if (!teamStats[team.id]) {
                    teamStats[team.id] = { name: team.name, points: 0, activations: 0 };
                }
                teamStats[team.id].points += act.points;
                teamStats[team.id].activations += 1;

                // User Stats (Split points equally or assign full to both? Usually shared or per team)
                // Let's assign to users for individual tracking
                team.members.forEach(member => {
                    if (!userStats[member.id]) {
                        userStats[member.id] = { username: member.username, points: 0, activations: 0 };
                    }
                    // Assuming points are per team, so each member gets credit for the team's work? 
                    // Or points are split? Let's assume points are attributed to the team for now.
                    // If we want per-user, we might need to know who specifically did it, but usually it's the team.
                    // Let's just track by Team for payroll purposes as requested "per team".
                });
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
            select: { teamId: true }
        });

        if (!user.teamId) {
            return res.json({ message: 'User not assigned to a team', appointments: [], stats: {} });
        }

        // 2. Get Team Appointments (Calendar)
        const today = new Date();
        const startOfYear = new Date(today.getFullYear(), 0, 1);

        const appointments = await prisma.appointment.findMany({
            where: {
                assignedTeamId: user.teamId,
                // assignedDate: { gte: startOfYear }
            },
            include: {
                address: {
                    include: {
                        project: true,
                        activationInfo: true
                    }
                }
            },
            orderBy: { assignedDate: 'asc' }
        });

        // 3. Get Performance Stats (Current Month)
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const activations = await prisma.activationInfo.findMany({
            where: {
                createdAt: {
                    gte: startOfMonth,
                    lte: endDate
                },
                address: {
                    appointment: {
                        assignedTeamId: user.teamId
                    }
                }
            }
        });

        let regularPoints = 0;
        let saturdayPoints = 0;
        let regularActivations = 0;
        let saturdayActivations = 0;

        // Production Counts
        const counts = {
            bp: 0,
            ta: 0,
            sp: 0,
            mdu: 0
        };

        activations.forEach(act => {
            const type = act.activationType || 'BP';

            // Base Production Counts
            if (type === 'BP_2_FAM') {
                counts.bp += 2;
            } else {
                counts.bp++;
            }

            // Additional Component Counts (TA/SP/MDU) - Counted regardless of activation type
            if (act.spInstalled > 0) {
                counts.sp += act.spInstalled;
            }

            if (act.taInstalled || (act.taCount && act.taCount > 0)) {
                counts.ta += (act.taCount || 1);
            }

            if (act.mduInstalled) {
                counts.mdu++;
            }

            // Saturday stats
            if (act.isSaturday) {
                saturdayPoints += act.points;
                saturdayActivations++;
            } else {
                regularPoints += act.points;
                regularActivations++;
            }
        });

        // 4. Get Settings
        const settings = await prisma.systemSettings.findFirst() || {
            monthlyTargetPoints: 100,
            extraPointPrice: 0,
            saturdayPointPrice: 0
        };

        res.json({
            appointments,
            stats: {
                regularPoints,
                saturdayPoints,
                regularActivations,
                saturdayActivations,
                counts, // New detailed counts
                target: settings.monthlyTargetPoints,
                extraPrice: settings.extraPointPrice,
                saturdayPrice: settings.saturdayPointPrice,
                isBonusMode: regularPoints >= settings.monthlyTargetPoints
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching activator dashboard' });
    }
};
