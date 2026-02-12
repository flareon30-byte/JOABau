const prisma = require('../prisma');

// Helper: Calculate working days for a given month/year (Default current)
// Simplified version of the calendar utils
const getWorkingDays = (year, month) => {
    // 0 = Jan, 11 = Dec
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    let count = 0;

    // Holidays NRW 2026 (simplified set for example)
    // In a real app, use a robust holiday library or DB table
    const holidays2026 = [
        '0-1', '2-29', '3-2', '4-1', '4-10', '4-21', '5-1', '5-11', '7-15', '9-3', '10-1', '11-25', '11-26'
        // Note: Month is 0-indexed in JS date, but let's use M-D strings
        // Adjust as needed for specific strictness. 
        // For now, let's use a standard approximation or the fixed value from the user's calculator if possible.
        // User calculator uses a util. Let's approximate to ~21 or calculate weekdays.
    ];

    // Simple Weekday Count
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6) { // Not Sunday (0) or Saturday (6)
            count++;
        }
    }
    return count;
};

// Helper: Logic to calculate Group Financials (Mirroring Calculator App.jsx)
const calculateGroupFinancials = (activations, financialConfig, teamMembers, overhead = 0, month, year) => {
    // Defaults
    const stats = {
        totalRevenue: 0,
        totalCost: 0,
        netResult: 0, // Profit
        bonusPool: 0,
        unitsDone: 0,
        breakEvenUnits: 0,
        progressPercent: 0,
        saturdayPay: 0,
        details: {
            salaryCost: 0,
            opCost: 0,
            bonusCost: 0,
            saturdayCost: 0
        },
        counts: { bp: 0, ta: 0, multi: 0, mdu: 0, saturday: 0 }
    };

    if (!financialConfig) return stats;

    const teamSize = teamMembers.length || 1;
    // We assume 'count' in calculator refers to total people in group. Here we calc PER TEAM usually.
    // The calculator logic is "Group Global". We need to apply it "Per Team".
    // "One Team" instance:
    const count = teamSize;
    const numberOfTeams = 1; // By definition, we are calculating for ONE team here.

    const workingDays = getWorkingDays(year, month);

    // --- 1. EXPENSES (Costs) ---

    // Per Person Expenses
    const salary = financialConfig.salary || 1500;
    const insurance = (financialConfig.insurance !== undefined) ? financialConfig.insurance : (salary * 0.215);
    const sokaBauPercent = financialConfig.sokaBauPercent || 0;
    const sokaBau = (sokaBauPercent > 0) ? (salary * sokaBauPercent / 100) : 0;
    const dietasPerDay = financialConfig.dietasPerDay || 0;
    const rent = financialConfig.rent || 0;
    const materialsPerPerson = financialConfig.materials || 0; // Calculator has materials in "Per Person" block visually? No, in "Operative Expenses" usually per team or person.
    // In Calculator `perPersonExpenses` includes materials. 
    // `group.materials` in calc initialData seems to be 100 per person? Or Team?
    // "Gastos Operativos (Por Equipo/Mes)" -> Materiales.
    // Let's assume the config value is Per Team if it comes from the UI section "Gastos Operativos".
    // But wait, the shared calculator code puts materials in `perPersonExpenses` sum:
    // `group.salary + calcInsurance + calcSokaBau + group.rent + totalDietasPerPerson + group.materials;`
    // This implies materials is treated as PER PERSON cost in the calculator logic provided.

    const totalDietasPerPerson = dietasPerDay * workingDays; // Approx, ignoring saturdays for now or adding later

    const perPersonExpenses = salary + insurance + sokaBau + rent + totalDietasPerPerson + materialsPerPerson;

    // Per Team Expenses
    const car = financialConfig.car || 0;
    const gas = financialConfig.gas || 0;
    const perTeamExpenses = car + gas;

    // Total Fixed Expenses for this Team
    const groupExpenses = (perPersonExpenses * teamSize) + perTeamExpenses;

    // --- 2. REVENUE & PRODUCTION (Income) ---

    let standardUnits = 0;
    let taUnits = 0;
    let multiUnits = 0;
    let mduUnits = 0;
    let saturdayInstalls = 0;
    let saturdayTa = 0;
    let saturdayMulti = 0;

    let totalRevenue = 0;

    // Process Activations
    activations.forEach(act => {
        const isSaturday = act.isSaturday === true;
        const type = act.activationType || 'BP';

        // Prices from Config
        const pricePerUnit = financialConfig.pricePerUnit || 0;
        const pricePerMulti = financialConfig.pricePerMulti || 0; // Additional on top of base? Or full?
        // Calculator: "BR Multi seria el precio base + precio multi" for REVENUE?
        // In Calculator App.jsx:
        // `revenueInstalls = totalInstalls * group.pricePerUnit;`
        // `totalInstalls` includes `monthlyBaseUnits` (which are just the productivity count)
        // Multi units are counted separately in `totalMultiUnits`.
        // `multiIncome = totalMultiUnits * (group.multiRevenuePrice || 0);`
        // So Multi generates `pricePerUnit` (as an install) AND `multiRevenuePrice` (extra)?
        // Re-reading Calculator `calculateGroupFinancials`:
        // `const totalEffectiveUnits = ... (monthlyBaseUnits + (group.multiProductivity || 0))` -> This affects `regularProduction`.
        // `const regularIncome = regularProduction * group.pricePerUnit;`
        // So a Multi counts as a regular unit (getting `pricePerUnit`) PLUS it gets `multiRevenuePrice`.

        // Let's map our DB types to this logic:

        if (isSaturday) {
            // Saturday Logic
            if (type === 'BP' || type === 'BP_2_FAM') {
                saturdayInstalls++;
                stats.counts.saturday++;
                totalRevenue += pricePerUnit;
            } else if (type === 'BR_MULTI') {
                saturdayInstalls++; // Counts as base install too
                saturdayMulti++;
                stats.counts.saturday++;
                totalRevenue += (pricePerUnit + (financialConfig.multiRevenuePrice || 0));
            } else if (type === 'SDU') { // TA
                saturdayTa++;
                // SDU/TA might not count as "Install"? 
                // Calc says: `taIncome = totalTaUnits * (group.taRevenuePrice || 0);`
                // Does TA count towards `regularProduction`? 
                // `totalEffectiveUnits` combines base + multi. TA is separate in `totalTaUnits`.
                stats.counts.saturday++;
                totalRevenue += (financialConfig.taRevenuePrice || 0);
            }
        } else {
            // M-F Logic
            if (type === 'BP' || type === 'BP_2_FAM') {
                standardUnits++;
                stats.counts.bp++;
                totalRevenue += pricePerUnit;
            } else if (type === 'BR_MULTI') {
                standardUnits++; // Counts as install
                multiUnits++;
                stats.counts.multi++;
                totalRevenue += (pricePerUnit + (financialConfig.multiRevenuePrice || 0));
            } else if (type === 'SDU') {
                taUnits++;
                stats.counts.ta++;
                totalRevenue += (financialConfig.taRevenuePrice || 0);
            } else if (type === 'MDU') {
                mduUnits++;
                stats.counts.mdu++;
                // Assuming MDU is similar to Multi or own price
                totalRevenue += (financialConfig.pricePerMDU || 0);
            }
        }
    });

    stats.unitsDone = standardUnits + saturdayInstalls; // Total Base Installs
    // Note: Calculator uses Monthly INPUT for installs, but we are calculating from ACTUALS here.

    // --- 3. VARIABLE COSTS (Bonuses & Saturdays) ---

    let bonusCost = 0;
    let saturdayCost = 0;

    // A. Saturday Pay
    // "Tarifa Sábado Fix (€)" -> `saturdayRate`. 
    // Calc: `stats.saturdayPay = saturdayDays.size * financials.saturdayRate * memberCount;`
    // Wait, the new Calc code says:
    // `costSatInst = satInstalls * (group.bonusPerUnit || 0) * 2;`
    // `costSatTa = satTa * (group.bonusPerTa || 0) * 2;`
    // `saturdayCost = costSatInst + ...`
    // AND `return acc + ((group.saturdaysWorked || 0) * (group.saturdayRate || 0));` in the detailed breakdown.
    // It seems there are TWO components:
    // 1. Fixed "Saturday Rate" (e.g. 40€) probably per person or team? `saturdayRate` in config.
    // 2. Double Bonus per unit.

    // Let's implement the Cost of Saturday Rate:
    // We need to know how many Saturdays were worked.
    const saturdayDates = new Set();
    activations.filter(a => a.isSaturday).forEach(a => saturdayDates.add(new Date(a.createdAt).toDateString()));
    const saturdaysWorkedCount = saturdayDates.size;

    // Cost: Days * Rate * Members (Assuming Rate is per person)
    const fixedSaturdayCost = saturdaysWorkedCount * (financialConfig.saturdayRate || 0) * teamSize;

    // Cost: Double Bonus
    const varSaturdayCost =
        (saturdayInstalls * (financialConfig.bonusPerUnit || 0) * 2) +
        (saturdayMulti * (financialConfig.bonusPerMulti || 0) * 2) +
        (saturdayTa * (financialConfig.bonusPerTa || 0) * 2);

    saturdayCost = fixedSaturdayCost + varSaturdayCost;
    stats.saturdayPay = saturdayCost; // Total pay to team for Sat

    // B. Production Bonus (M-F)
    // Calc Logic:
    // `totalVariableCosts = taCost + multiCost + saturdayCost;`
    // `totalAbsoluteExpenses = groupExpenses + totalVariableCosts;`
    // `breakEvenUnits = group.pricePerUnit > 0 ? (groupExpenses / group.pricePerUnit) : 0;`
    // NOTE: BreakEven uses ONLY `groupExpenses` (Fixed), not variable.

    const breakEvenUnits = (financialConfig.pricePerUnit > 0)
        ? (groupExpenses / financialConfig.pricePerUnit)
        : 0;

    stats.breakEvenUnits = Math.ceil(breakEvenUnits);

    // Bonus Potential
    // "Potential should be based on EXTRA units (above break-even)."
    // "Multi/TA revenue helps generate Surplus... BUT it should not lower the Installation Break Even bar."

    const totalInstalls = stats.unitsDone; // Base installs
    const extraUnits = Math.max(0, totalInstalls - breakEvenUnits);

    const bonusPotInstalls = extraUnits * (financialConfig.bonusPerUnit || 0);
    const bonusPotTa = taUnits * (financialConfig.bonusPerTa || 0); // Pure bonus? Code: `totalTaUnits * (group.bonusPerTa || 0)`
    const bonusPotMulti = multiUnits * (financialConfig.bonusPerMulti || 0);

    const totalBonusPotential = bonusPotInstalls + bonusPotTa + bonusPotMulti;

    // Surplus check
    // "We subtract the 'overhead' (Global Deficit) from the revenue before checking for surplus."
    // `const totalAbsoluteExpenses = groupExpenses + totalVariableCosts;`
    // `const surplus = Math.max(0, totalRevenue - totalAbsoluteExpenses - overhead);`

    const taCost = taUnits * (financialConfig.taPrice || 0); // "Variable Cost" M-F
    const multiCost = multiUnits * (financialConfig.multiPrice || 0);

    const totalVariableCosts = taCost + multiCost + saturdayCost;
    const totalAbsoluteExpenses = groupExpenses + totalVariableCosts;

    const surplus = Math.max(0, totalRevenue - totalAbsoluteExpenses - overhead);

    if (totalRevenue > 0 && surplus > 0) {
        if (surplus < 5) {
            bonusCost = 0;
        } else {
            // "Pay the full defined bonus, capped by the available surplus, rounded down to integer."
            bonusCost = Math.floor(Math.min(totalBonusPotential, surplus));
        }
    } else {
        bonusCost = 0;
    }

    stats.bonusPool = bonusCost; // Total bonus pool for the team

    // --- 4. RESULTS ---
    stats.totalCost = totalAbsoluteExpenses + bonusCost; // Is bonus part of cost? Yes.
    stats.totalRevenue = totalRevenue;
    stats.netResult = totalRevenue - stats.totalCost;

    stats.details.salaryCost = groupExpenses; // Fixed base
    stats.details.opCost = perTeamExpenses; // Part of groupExpenses really, but separate for UI? 
    // Let's match UI "Costes de Personal" vs "Gastos Operativos"
    stats.details.salaryCost = (perPersonExpenses * teamSize);
    stats.details.opCost = perTeamExpenses;

    // Progress
    if (stats.breakEvenUnits > 0) {
        stats.progressPercent = Math.min(100, (stats.unitsDone / stats.breakEvenUnits) * 100);
    } else {
        stats.progressPercent = 100;
    }

    stats.taUnits = taUnits + saturdayTa;
    stats.multiUnits = multiUnits + saturdayMulti;

    return stats;
};


exports.getMyPayroll = async (req, res) => {
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { team: true }
        });

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

        if (!team && user.role === 'SUPER_ADMIN') {
            team = { id: 'virtual', name: 'Modo Administrador', members: [user] };
        }

        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(); // Today

        const settings = await prisma.systemSettings.findFirst({
            where: { isDemo: req.isDemo || false }
        });

        // 1. Back Office Special Case
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
                metrics: { appointmentsDone: apptCount, targetDaily: 15, revenueGenerated: revenue },
                financials: { total: config.salary || 1500 }
            });
        }

        // 2. Installers/Blowers
        const groupKey = user.role === 'BLOWER' ? 'blowers' : 'installers';
        const financialConfig = settings?.financials ? settings.financials[groupKey] : null;

        let activations = [];
        if (teamId) {
            activations = await prisma.activationInfo.findMany({
                where: {
                    createdAt: { gte: start, lte: end },
                    address: {
                        project: { isDemo: req.isDemo || false },
                        appointment: { assignedTeamId: teamId }
                    }
                }
            });
        }

        const teamMembers = team ? team.members : [user];

        // Overhead Logic (Mirroring Calculator)
        // Ideally we need to calculate ALL groups to find the global deficit (StartUp cost, Support cost etc).
        // For individual `getMyPayroll`, doing a full system sim might be heavy.
        // Option: Assume 0 overhead for individual view OR simplify.
        // Calculator says: "We assume the FIRST installer team bears the burden...".
        // If this user is 'installers' group, they might see a "Goal" that includes overhead.
        // For now, let's pass 0 overhead to keep `getMyPayroll` fast, but acknowledge it might slightly differ from "Admin View" if deficit exists. 
        // Or better: Fetch basic deficit if possible. 
        // Let's stick to 0 for specific user view speed unless requested.

        const stats = calculateGroupFinancials(activations, financialConfig, teamMembers, 0, now.getMonth(), now.getFullYear());

        const memberCount = teamMembers.length || 1;
        const myBonus = stats.bonusPool / memberCount;
        const mySaturday = stats.saturdayPay / memberCount;
        const myTotal = (financialConfig?.salary || user.baseSalary) + myBonus + mySaturday;

        res.json({
            financials: financialConfig,
            stats: {
                ...stats,
                activationsCount: activations.length,
                teamName: team?.name || 'Sin Equipo'
            },
            personal: {
                baseSalary: financialConfig?.salary || user.baseSalary || 0,
                myBonusShare: myBonus,
                mySaturdayPay: mySaturday,
                totalEstimated: myTotal
            }
        });

    } catch (error) {
        console.error('Error getting my payroll:', error);
        res.status(500).json({ message: 'Error fetching my payroll' });
    }
};

exports.getPayrollSummary = async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    try {
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        if (startDate && !startDate.includes('T')) start.setHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : new Date();
        if (endDate && !endDate.includes('T')) end.setHours(23, 59, 59, 999);

        const monthForDays = start.getMonth();
        const yearForDays = start.getFullYear();

        const settings = await prisma.systemSettings.findFirst({
            where: { isDemo: req.isDemo || false }
        });

        // Fetch Users & Activations
        const users = await prisma.user.findMany({
            where: { isDemo: req.isDemo || false },
            include: { team: { include: { members: true } } }
        });

        const activations = await prisma.activationInfo.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                address: { project: { isDemo: req.isDemo || false } }
            },
            include: {
                address: { include: { appointment: { include: { assignedTeam: true } } } }
            }
        });

        // Map Activations to Team
        const teamActs = {};
        activations.forEach(act => {
            const tid = act.address?.appointment?.assignedTeamId;
            if (tid) {
                if (!teamActs[tid]) teamActs[tid] = [];
                teamActs[tid].push(act);
            }
        });

        // We need to calculate Support Groups First to find Deficit (Overhead)
        // Group users by "Financial Type"
        const supportGroups = ['blowers', 'replanners', 'backoffice']; // Roles mapped to these keys
        let supportProfit = 0;

        // This is tricky because users are individual rows but calculation is by Team/Group.
        // We will calc per-user for the list, but for overhead we need conceptual "Groups".
        // Let's just calculate per-user/team stats normally and sum their NetResult.
        // If a team is "Blower", their profit adds to supportProfit.

        const processedUsers = users.map(user => {
            const team = user.team;
            const teamId = team?.id;
            let groupKey = 'installers'; // Default
            if (user.role === 'BLOWER') groupKey = 'blowers';
            if (user.role === 'BACK_OFFICE') groupKey = 'backOffice';
            // 'replanners' role? Assuming not implemented in UserRole enum yet or handled as Blower/Other.

            const financialConfig = settings?.financials ? settings.financials[groupKey] : null;

            let stats = null;

            if (user.role === 'BACK_OFFICE') {
                // Simplified Back Office Calc
                const baseSalary = financialConfig?.salary || 0;
                // We'd need to fetch their specific appointments count here.
                // For summary performance optimize later.
                stats = { netResult: 0 - baseSalary }; // Cost center initially
            } else if (team) {
                const acts = teamActs[teamId] || [];
                // Overhead is 0 initially
                stats = calculateGroupFinancials(acts, financialConfig, team.members, 0, monthForDays, yearForDays);
            } else {
                stats = { netResult: 0 - (user.baseSalary || 0) };
            }

            return { user, stats, groupKey };
        });

        // Calc Deficit
        // Filter "Support" types.
        const supportStats = processedUsers.filter(u => u.groupKey !== 'installers');
        const netOthers = supportStats.reduce((acc, u) => acc + (u.stats.netResult || 0), 0);

        // "If the total is negative, Installers need to cover that remaining hole."
        const totalDeficit = netOthers < 0 ? Math.abs(netOthers) : 0;

        // Count Installer Teams to split overhead? 
        // Calculator: "First installer team bears the burden".
        // We need to identify the "First" team. Let's say sorted by ID or Creation.
        // For simplicity in this summary view, we won't re-run the calculation for the ID=1 team separately 
        // unless we want perfect precision.
        // Let's just return the `totalDeficit` in metadata so Frontend can display it or note it.

        const summary = processedUsers.map(({ user, stats, groupKey }) => {
            // Formating for response
            const personal = {
                baseSalary: user.baseSalary || 0,
                bonus: 0,
                saturday: 0,
                total: user.baseSalary || 0
            };

            if (stats && stats.bonusPool) {
                const members = user.team?.members?.length || 1;
                personal.bonus = stats.bonusPool / members;
                personal.saturday = stats.saturdayPay / members;
                personal.total += personal.bonus + personal.saturday;
            }

            return {
                id: user.id,
                username: user.username,
                role: user.role,
                ...personal,
                production: { ...stats, type: groupKey }
            };
        });

        res.json({
            meta: { range: { start, end }, globalDeficit: totalDeficit },
            data: summary
        });

    } catch (error) {
        console.error('Error Admin Payroll:', error);
        res.status(500).json({ message: 'Error fetching payroll data' });
    }
};
