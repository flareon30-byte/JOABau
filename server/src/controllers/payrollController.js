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

// Helper to calculate advanced financials
const calculateAdvancedPayroll = (activations, financials, teamMembers) => {
    // defaults
    const stats = {
        totalRevenue: 0,
        totalCost: 0,
        netResult: 0,
        bonusPool: 0,
        unitsDone: 0,
        breakEvenUnits: 0,
        progressPercent: 0,
        saturdayPay: 0,
        details: {
            salaryCost: 0,
            opCost: 0
        }
    };

    if (!financials) return stats;

    const memberCount = teamMembers.length || 1;

    // 1. Calculate Costs
    // Personnel: (Salary + Insurance + (Dietas * 21)) * Members
    // Note: Dietas is per day, assuming avg 21 working days
    const personnelMonthly = (financials.salary + financials.insurance + (financials.dietasPerDay * 21)) * memberCount;

    // Operational: Fixed per team
    const operationalMonthly = financials.car + financials.gas + financials.materials;

    stats.totalCost = personnelMonthly + operationalMonthly;
    stats.details.salaryCost = personnelMonthly;
    stats.details.opCost = operationalMonthly;

    // 2. Calculate Revenue & Units
    // We need to distinguish unit types if possible, otherwise treat all as standard units
    // For installers, standard unit is an Activation.
    // Check for TA/Multi types if properties exist on activation?
    // Current ActivationInfo schema might not have detailed type easily accessible or it uses 'activationType' enum?
    // We will count basic units for now.

    let standardUnits = 0;
    let saturdayDays = new Set(); // To count distinct saturday dates

    activations.forEach(act => {
        standardUnits++;

        // Revenue from this unit
        stats.totalRevenue += financials.pricePerUnit;

        // Saturday check
        if (act.isSaturday) {
            const dateStr = new Date(act.createdAt).toDateString();
            saturdayDays.add(dateStr);
        }
    });

    stats.unitsDone = standardUnits;

    // 3. Break Even
    // How many units needed to cover totalCost?
    stats.breakEvenUnits = financials.pricePerUnit > 0 ? Math.ceil(stats.totalCost / financials.pricePerUnit) : 0;

    // 4. Progress
    if (stats.breakEvenUnits > 0) {
        stats.progressPercent = Math.min(100, (stats.unitsDone / stats.breakEvenUnits) * 100);
    } else {
        stats.progressPercent = 100;
    }

    // 5. Bonus Calculation
    // Bonus is paid for units ABOVE breakEven
    const extraUnits = Math.max(0, stats.unitsDone - stats.breakEvenUnits);
    stats.bonusPool = extraUnits * financials.bonusPerUnit;

    // 6. Saturday Pay (Fixed per Saturday worked? or per unit?)
    // Settings says "Tarifa Sábado (Por día)". 
    // We need to count how many distinct Saturdays the team worked.
    stats.saturdayPay = saturdayDays.size * financials.saturdayRate * memberCount; // Paying rate to EACH member for that day? Or total for team?
    // "Tarifa Sábado Fix (€)" in UI suggests a flat rate. Usually saturday pay is per person.
    // I will assume the rate in settings is PER PERSON per Saturday.

    return stats;
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

        const teamId = user.teamId;
        let team = null;

        if (teamId) {
            team = await prisma.team.findUnique({
                where: { id: teamId },
                include: { members: true }
            });
        }

        // Fallback for Admin without team
        if (!team) {
            team = {
                id: 'virtual',
                name: 'Modo Administrador (Sin Equipo)',
                members: [user]
            };
        }

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date();

        const settings = await prisma.systemSettings.findFirst();

        // Determine Financial Group (Installers vs Blowers)
        const groupKey = user.role === 'BLOWER' ? 'blowers' : 'installers';
        const financialConfig = settings?.financials ? settings.financials[groupKey] : null;

        // Fetch user's team activations
        let activations = [];
        if (teamId) {
            activations = await prisma.activationInfo.findMany({
                where: {
                    createdAt: { gte: start, lte: end },
                    address: {
                        appointment: {
                            assignedTeamId: teamId
                        }
                    }
                }
            });
        }

        // Use new calculation logic
        const advancedStats = calculateAdvancedPayroll(activations, financialConfig, team.members);

        // Calculate user's share (assuming equal split among team members for the bonus pool)
        const memberCount = team.members.length || 1;
        const myBonusShare = advancedStats.bonusPool / memberCount;
        const mySaturdayPay = advancedStats.saturdayPay / memberCount;

        res.json({
            financials: financialConfig,
            stats: {
                ...advancedStats,
                teamName: team.name
            },
            personal: {
                baseSalary: user.baseSalary || (financialConfig?.salary || 0), // Use user's specific or config default
                myBonusShare,
                mySaturdayPay,
                totalEstimated: (user.baseSalary || financialConfig?.salary || 0) + myBonusShare + mySaturdayPay
            }
        });

    } catch (error) {
        console.error('Error getting my payroll:', error);
        res.status(500).json({ message: 'Error fetching my payroll' });
    }
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
