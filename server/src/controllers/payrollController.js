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
    const operationalMonthly = financials.car + financials.gas + financials.materials + (financials.equipmentRent || 0);

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
    let potentialBonus = 0;
    let saturdayDays = new Set();

    // Detailed Counters
    stats.counts = {
        bp: 0,    // BP + BP_2_FAM
        ta: 0,    // SDU
        multi: 0, // BR_MULTI
        mdu: 0    // MDU
    };

    activations.forEach(act => {
        standardUnits++;

        let price = 0;
        let bonus = 0;
        const type = act.activationType || 'BP'; // Default to BP

        switch (type) {
            case 'BP':
            case 'BP_2_FAM':
                // "BP basic y BP 2 familias seria el precio base"
                price = financials.pricePerUnit || 0;
                bonus = financials.bonusPerUnit || 0;
                stats.counts.bp++;
                break;

            case 'BR_MULTI':
                // "BR Multi seria el precio base + precio multi"
                price = (financials.pricePerUnit || 0) + (financials.pricePerMulti || 0);
                bonus = (financials.bonusPerUnit || 0) + (financials.bonusPerMulti || 0);
                stats.counts.multi++;
                break;

            case 'SDU':
                // "SDU seria Precio TA"
                price = financials.pricePerTA || 0;
                bonus = financials.bonusPerTA || 0;
                stats.counts.ta++;
                break;

            case 'MDU':
                // New MDU Price
                price = financials.pricePerMDU || 0;
                bonus = financials.bonusPerMDU || 0;
                stats.counts.mdu++;
                break;

            // Fallback for any other type (e.g. legacy data)
            default:
                price = financials.pricePerUnit || 0;
                bonus = financials.bonusPerUnit || 0;
                stats.counts.bp++;
                break;
        }

        stats.totalRevenue += price;
        potentialBonus += bonus;

        if (act.isSaturday) {
            const dateStr = new Date(act.createdAt).toDateString();
            saturdayDays.add(dateStr);
        }
    });

    stats.unitsDone = standardUnits;

    // 3. Break Even (Dynamic based on average revenue per unit this month)
    const avgPrice = standardUnits > 0 ? (stats.totalRevenue / standardUnits) : financials.pricePerUnit;
    stats.breakEvenUnits = avgPrice > 0 ? Math.ceil(stats.totalCost / avgPrice) : 0;

    // 4. Progress
    if (stats.breakEvenUnits > 0) {
        stats.progressPercent = Math.min(100, (stats.unitsDone / stats.breakEvenUnits) * 100);
    } else {
        stats.progressPercent = 100;
    }

    // 5. Bonus Calculation (Proportional Surplus)
    // We calculate what % of the work done was "extra" above break-even, 
    // and pay that same % of the total generated bonus potential.
    if (stats.unitsDone > stats.breakEvenUnits) {
        const profitableUnits = stats.unitsDone - stats.breakEvenUnits;
        const profitableRatio = profitableUnits / stats.unitsDone;

        stats.bonusPool = potentialBonus * profitableRatio;
    } else {
        stats.bonusPool = 0;
    }

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

        // Allow Super Admin and Back Office to proceed without a team
        if (!user || (!user.teamId && user.role !== 'SUPER_ADMIN' && user.role !== 'BACK_OFFICE')) {
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
        if (!team && user.role === 'SUPER_ADMIN') {
            team = {
                id: 'virtual',
                name: 'Modo Administrador (Sin Equipo)',
                members: [user]
            };
        }

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(); // Today

        const settings = await prisma.systemSettings.findFirst({
            where: { isDemo: req.isDemo || false }
        });

        // Logic for Back Office
        if (user.role === 'BACK_OFFICE') {
            const config = settings?.financials?.backOffice || {};
            const apptCount = await prisma.appointment.count({
                where: {
                    scheduledById: user.id,
                    status: { in: ['CITADO', 'COMPLETADO'] },
                    updatedAt: { gte: start, lte: end }
                }
            });
            const revenue = apptCount * (config.pricePerAppointment || 15);

            return res.json({
                role: 'BACK_OFFICE',
                baseSalary: config.salary || user.baseSalary || 1500,
                metrics: {
                    appointmentsDone: apptCount,
                    targetDaily: 15,
                    revenueGenerated: revenue
                },
                financials: {
                    total: config.salary || user.baseSalary || 1500
                }
            });
        }

        // Logic for Installers / Blowers
        const groupKey = user.role === 'BLOWER' ? 'blowers' : 'installers';
        const financialConfig = settings?.financials ? settings.financials[groupKey] : null;

        let activations = [];
        if (teamId) {
            activations = await prisma.activationInfo.findMany({
                where: {
                    createdAt: { gte: start, lte: end },
                    address: {
                        project: { isDemo: req.isDemo || false },
                        appointment: {
                            assignedTeamId: teamId
                        }
                    }
                }
            });
        }

        // Safe team members access
        const teamMembers = team ? team.members : [user];
        const stats = calculateAdvancedPayroll(activations, financialConfig, teamMembers);

        // User share
        const memberCount = teamMembers.length || 1;
        const myBonus = stats.bonusPool / memberCount;
        const mySaturday = stats.saturdayPay / memberCount;
        const myTotal = (financialConfig?.salary || user.baseSalary) + myBonus + mySaturday;

        res.json({
            role: user.role,
            teamName: user.team?.name || 'Sin Equipo',
            baseSalary: financialConfig?.salary || user.baseSalary,
            financials: {
                bonus: myBonus,
                saturday: mySaturday,
                total: myTotal
            },
            production: {
                ...stats,
                activationsCount: activations.length
            }
        });

    } catch (error) {
        console.error('Error getting my payroll:', error);
        res.status(500).json({ message: 'Error fetching my payroll' });
    }
};

exports.getPayrollSummary = async (req, res) => {
    const { startDate, endDate, userId } = req.query;

    console.log('Fetching Admin Payroll Summary', { startDate, endDate, userId });

    try {
        // Parse dates (Frontend should provide YYYY-MM-DD)
        // Ensure strictly parsed to start of day and end of day
        // If provided as strings YYYY-MM-DD:
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        // Fix timezone/EOD issues by ensuring we target the full day if only date is given
        if (startDate && !startDate.includes('T')) start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : new Date();
        if (endDate && !endDate.includes('T')) end.setHours(23, 59, 59, 999);

        const settings = await prisma.systemSettings.findFirst({
            where: { isDemo: req.isDemo || false }
        });

        // 1. Fetch Users
        const usersWhere = { isDemo: req.isDemo || false };
        if (userId && userId !== 'all') usersWhere.id = userId;

        const users = await prisma.user.findMany({
            where: usersWhere,
            include: { team: { include: { members: true } } },
            orderBy: { username: 'asc' }
        });

        // 2. Fetch Activations in Range
        const activations = await prisma.activationInfo.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                address: { project: { isDemo: req.isDemo || false } }
            },
            include: {
                address: {
                    include: {
                        appointment: {
                            include: { assignedTeam: true }
                        }
                    }
                }
            }
        });

        // 3. Group Activations by Team
        const teamActivations = {};
        activations.forEach(act => {
            const teamId = act.address?.appointment?.assignedTeamId;
            if (teamId) {
                if (!teamActivations[teamId]) teamActivations[teamId] = [];
                teamActivations[teamId].push(act);
            }
        });

        // 4. Calculate for each User
        const summary = await Promise.all(users.map(async (user) => {
            const team = user.team;
            const teamId = team?.id;

            // Determine config
            let groupKey = 'installers';
            if (user.role === 'BLOWER') groupKey = 'blowers';
            if (user.role === 'BACK_OFFICE') groupKey = 'backOffice';

            const financialConfig = settings?.financials ? settings.financials[groupKey] : null;
            const baseSalary = financialConfig?.salary || user.baseSalary || 0;

            let stats = null;
            let personal = {
                baseSalary: baseSalary,
                bonus: 0,
                saturday: 0,
                total: 0
            };

            if (user.role === 'BACK_OFFICE') {
                // Back Office Logic
                // Count appointments scheduled by this user in the range with status CITADO or COMPLETADO
                const appointmentCount = await prisma.appointment.count({
                    where: {
                        scheduledById: user.id,
                        status: { in: ['CITADO', 'COMPLETADO'] },
                        updatedAt: { gte: start, lte: end } // Use updatedAt when they secured the appointment
                    }
                });

                // Calculate generated revenue
                const revenuePerAppt = financialConfig?.pricePerAppointment || 15;
                const totalRevenue = appointmentCount * revenuePerAppt;

                // Calculate simple cost (Salary + Insurance + OpCost)
                // OpCost is per person for BackOffice
                const monthlyCost = (financialConfig?.salary || 0) + (financialConfig?.insurance || 0) + (financialConfig?.opCostPerPerson || 0);

                personal.total = baseSalary; // Back Office typically fixed salary unless specific bonus logic added

                stats = {
                    type: 'BACK_OFFICE',
                    appointmentsDone: appointmentCount,
                    totalRevenue: totalRevenue,
                    cost: monthlyCost,
                    profit: totalRevenue - monthlyCost,
                    targetDaily: 15, // Hardcoded expectation for now
                    todayCount: 0 // Calculated later if needed or separate query
                };

            } else if (team) {
                // Installer/Blower Logic
                const acts = teamActivations[teamId] || [];
                const teamStats = calculateAdvancedPayroll(acts, financialConfig, team.members);

                // User Share
                const memberCount = team.members.length || 1;
                personal.bonus = teamStats.bonusPool / memberCount;
                personal.saturday = teamStats.saturdayPay / memberCount;
                personal.total = personal.baseSalary + personal.bonus + personal.saturday;

                stats = {
                    type: 'TEAM',
                    teamName: team.name,
                    ...teamStats
                };
            } else {
                // Admin or Unassigned
                personal.total = personal.baseSalary;
                stats = {
                    type: 'no_team',
                    teamName: 'Sin Equipo',
                    unitsDone: 0
                };
            }

            return {
                id: user.id,
                username: user.username,
                role: user.role,
                ...personal,
                production: stats
            };
        }));

        res.json({
            meta: { range: { start, end } },
            data: summary
        });

    } catch (error) {
        console.error('Error Admin Payroll:', error);
        res.status(500).json({ message: 'Error fetching payroll data' });
    }
};
