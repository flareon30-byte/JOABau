const prisma = require('../prisma');

const calculatePayroll = (activations, settings, teamSize = 1) => {
    const weekdayPrice = settings?.extraPointPrice || 0;
    const saturdayPrice = settings?.saturdayPointPrice || 0;
    const monthlyTarget = settings?.monthlyTargetPoints || 100;

    // Aggregate Data by Team
    const teamMap = {};

    activations.forEach(act => {
        const team = act.address?.appointment?.assignedTeam;
        if (!team) return;

        const teamId = team.id;

        if (!teamMap[teamId]) {
            teamMap[teamId] = {
                id: teamId,
                name: team.name,
                members: team.members ? team.members.map(m => m.username).join(', ') : 'Sin miembros',
                memberCount: team.members ? team.members.length : 1,
                weekdayPoints: 0,
                saturdayPoints: 0,
                totalPoints: 0,
                weekdayMoney: 0,
                saturdayMoney: 0,
                totalMoney: 0,
                target: monthlyTarget // Global target (or could be per person: monthlyTarget * memberCount)
            };
        }

        const points = act.points || 0;
        const isSaturday = act.isSaturday === true;

        teamMap[teamId].totalPoints += points;

        if (isSaturday) {
            teamMap[teamId].saturdayPoints += points;
            // Saturdays usually paid directly without target threshold
            teamMap[teamId].saturdayMoney += (points * saturdayPrice);
        } else {
            teamMap[teamId].weekdayPoints += points;
        }
    });

    // Calculate Weekday Money based on Target
    Object.values(teamMap).forEach(team => {
        // Option 1: Target is PER TEAM (Simple)
        const target = team.target;

        // Bonus only applied to points ABOVE target
        const bonusPoints = Math.max(0, team.weekdayPoints - target);

        team.weekdayMoney = bonusPoints * weekdayPrice;
        team.totalMoney = team.weekdayMoney + team.saturdayMoney;
        team.bonusPoints = bonusPoints; // For display
    });

    return Object.values(teamMap).sort((a, b) => b.totalPoints - a.totalPoints);
};

exports.getPayrollSummary = async (req, res) => {
    const { startDate, endDate } = req.query;

    console.log('Fetching Payroll Summary', { startDate, endDate });

    try {
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date();

        // 1. Fetch System Settings
        const settings = await prisma.systemSettings.findFirst();

        // 2. Fetch Activations
        const activations = await prisma.activationInfo.findMany({
            where: {
                createdAt: { gte: start, lte: end }
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

        const summary = calculatePayroll(activations, settings);

        res.json({
            meta: {
                prices: {
                    weekday: settings?.extraPointPrice || 0,
                    saturday: settings?.saturdayPointPrice || 0,
                    target: settings?.monthlyTargetPoints || 100
                },
                range: { start, end }
            },
            data: summary
        });

    } catch (error) {
        console.error('Error getting payroll summary:', error);
        res.status(500).json({ message: 'Error fetching payroll data' });
    }
};

exports.getMyPayroll = async (req, res) => {
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { team: true }
        });

        if (!user || (!user.teamId && user.role !== 'SUPER_ADMIN')) {
            return res.status(400).json({ message: 'User not assigned to a team' });
        }

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
        const end = new Date(); // Today

        const settings = await prisma.systemSettings.findFirst();

        // Fetch user's team activations
        const activations = await prisma.activationInfo.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                address: {
                    appointment: {
                        assignedTeamId: user.teamId
                    }
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

        const summary = calculatePayroll(activations, settings); // Will return list (likely size 1)
        const myTeamStats = summary.find(s => s.id === user.teamId) || {
            weekdayPoints: 0, saturdayPoints: 0, totalPoints: 0,
            weekdayMoney: 0, saturdayMoney: 0, totalMoney: 0,
            id: user.teamId, name: user.team?.name || 'Mi Equipo', target: settings?.monthlyTargetPoints || 100
        };

        res.json({
            stats: myTeamStats,
            meta: {
                prices: {
                    weekday: settings?.extraPointPrice || 0,
                    saturday: settings?.saturdayPointPrice || 0,
                    target: settings?.monthlyTargetPoints || 100
                }
            }
        });

    } catch (error) {
        console.error('Error getting my payroll:', error);
        res.status(500).json({ message: 'Error fetching my payroll' });
    }
};
