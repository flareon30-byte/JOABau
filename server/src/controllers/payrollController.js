const prisma = require('../prisma');

exports.getPayrollSummary = async (req, res) => {
    const { startDate, endDate } = req.query;

    console.log('Fetching Payroll Summary', { startDate, endDate });

    try {
        const start = startDate ? new Date(startDate) : new Date(0); // Default to epoch
        const end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : new Date();

        // 1. Fetch System Settings for Prices
        const settings = await prisma.systemSettings.findFirst();
        const weekdayPrice = settings?.extraPointPrice || 0;
        const saturdayPrice = settings?.saturdayPointPrice || 0;

        // 2. Fetch Activations in Range with Relations
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

        // 3. Aggregate Data by Team
        const teamMap = {};

        activations.forEach(act => {
            const team = act.address?.appointment?.assignedTeam;
            if (!team) return; // Should not happen if data is clean, but safety first

            const teamId = team.id;
            const teamName = team.name;
            const members = team.members ? team.members.map(m => m.username).join(', ') : 'Sin miembros';

            if (!teamMap[teamId]) {
                teamMap[teamId] = {
                    id: teamId,
                    name: teamName,
                    members: members,
                    weekdayPoints: 0,
                    saturdayPoints: 0,
                    totalPoints: 0,
                    weekdayMoney: 0,
                    saturdayMoney: 0,
                    totalMoney: 0
                };
            }

            const points = act.points || 0;
            const isSaturday = act.isSaturday === true;

            teamMap[teamId].totalPoints += points;

            if (isSaturday) {
                teamMap[teamId].saturdayPoints += points;
                teamMap[teamId].saturdayMoney += (points * saturdayPrice);
            } else {
                teamMap[teamId].weekdayPoints += points;
                teamMap[teamId].weekdayMoney += (points * weekdayPrice);
            }

            // Recalculate Total Money
            teamMap[teamId].totalMoney = teamMap[teamId].weekdayMoney + teamMap[teamId].saturdayMoney;
        });

        // Convert Map to Array
        const summary = Object.values(teamMap).sort((a, b) => b.totalPoints - a.totalPoints);

        res.json({
            meta: {
                prices: { weekday: weekdayPrice, saturday: saturdayPrice },
                range: { start, end }
            },
            data: summary
        });

    } catch (error) {
        console.error('Error getting payroll summary:', error);
        res.status(500).json({ message: 'Error fetching payroll data' });
    }
};
