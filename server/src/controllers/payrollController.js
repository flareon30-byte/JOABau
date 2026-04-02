const prisma = require('../prisma');
const { calculateGroupFinancials } = require('../utils/financialUtils');

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
        counts: { bp: 0, ta: 0, sp: 0, mdu: 0, saturday: 0 }
    };

    if (!financialConfig) return stats;

    const teamSize = teamMembers.length || 1;
    // We assume 'count' in calculator refers to total people in group. Here we calc PER TEAM usually.
    // The calculator logic is "Group Global". We need to apply it "Per Team".
    // "One Team" instance:
    const count = teamSize;
    const numberOfTeams = 1; // By definition, we are calculating for ONE team here.

    // Use a fixed 21 days for budget-based target calculations to match the user's calculator
    const workingDays = 21;

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
    const equipRent = financialConfig.equipmentRent || 0;
    const perTeamExpenses = car + gas + equipRent;

    // Total Fixed Expenses for this Team
    const groupExpenses = (perPersonExpenses * teamSize) + perTeamExpenses;

    // --- 2. REVENUE & PRODUCTION (Income) ---

    let standardUnits = 0;
    let taUnits = 0;
    let spUnits = 0;
    let mduUnits = 0;
    let saturdayInstalls = 0;
    let saturdayTa = 0;
    let saturdaySp = 0;
    let saturdayMdu = 0;

    let totalRevenue = 0;

    // Process Activations
    activations.forEach(act => {
        const isSaturday = act.isSaturday === true;
        const type = act.activationType || 'BP';

        // --- 1. REVENUE CALCULATION ---
        // New Model: Use snapshot prices if available
        const snapshotRevenue = (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);

        if (snapshotRevenue > 0) {
            totalRevenue += snapshotRevenue;
        } else {
            // Legacy Model: Use Config Prices
            const pricePerUnit = financialConfig.pricePerUnit || 0;
            const multiRevenue = financialConfig.multiRevenuePrice || 0; // Extra for Multi (if used in old logic)
            const taRevenue = financialConfig.taRevenuePrice || 0;
            const mduRevenue = financialConfig.pricePerMDU || 0;

            if (type === 'BP' || type === 'BP_2_FAM') {
                totalRevenue += pricePerUnit;
            } else if (type === 'BR_MULTI') {
                // Assuming legacy BR_MULTI was Base + Multi Extra
                totalRevenue += (pricePerUnit + multiRevenue);
            } else if (type === 'SDU') {
                totalRevenue += taRevenue;
            } else if (type === 'MDU') {
                totalRevenue += mduRevenue;
            }
        }

        // --- 2. STATS & BONUS COUNTERS ---
        // We track these regardless of revenue source to ensure Bonus Logic works

        if (isSaturday) {
            stats.counts.saturday++;

            if (type === 'BR_MULTI') {
                saturdayInstalls++;
                stats.counts.bp++;

                const sps = (act.spInstalled || 0);
                saturdaySp += sps;
                stats.counts.sp += sps;

                if (act.taInstalled || (act.taCount && act.taCount > 0)) {
                    saturdayTa++;
                    stats.counts.ta++;
                } else if (act.mduInstalled) {
                    saturdayMdu++;
                    stats.counts.mdu++;
                }
            } else if (type === 'BP' || type === 'BP_2_FAM') {
                saturdayInstalls++;
                stats.counts.bp++;
            } else if (type === 'SDU') {
                saturdayTa++;
                stats.counts.ta++;
            } else if (type === 'MDU') {
                saturdayMdu++;
                stats.counts.mdu++;
            }

            // New Fields Tracking for Saturday (Legacy support)
            if (act.taCount > 0 && type !== 'SDU' && type !== 'BR_MULTI') {
                saturdayTa += act.taCount;
                stats.counts.ta += act.taCount;
            }
        } else {
            // M-F
            if (type === 'BR_MULTI') {
                standardUnits++; // This is BP
                stats.counts.bp++;

                const sps = (act.spInstalled || 0);
                spUnits += sps;
                stats.counts.sp += sps;

                if (act.taInstalled || (act.taCount && act.taCount > 0)) {
                    taUnits++;
                    stats.counts.ta++;
                } else if (act.mduInstalled) {
                    mduUnits++;
                    stats.counts.mdu++;
                }
            } else if (type === 'BP' || type === 'BP_2_FAM') {
                standardUnits++;
                stats.counts.bp++;
            } else if (type === 'SDU') {
                taUnits++;
                stats.counts.ta++;
            } else if (type === 'MDU') {
                mduUnits++;
                stats.counts.mdu++;
            }

            // New Fields Tracking for M-F (Legacy support)
            if (act.taCount > 0 && type !== 'SDU' && type !== 'BR_MULTI') {
                taUnits += act.taCount;
                stats.counts.ta += act.taCount;
            }
            if (act.mduInstalled && type !== 'MDU' && type !== 'BR_MULTI') {
                mduUnits++;
                stats.counts.mdu++;
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

    // Cost: Bonus
    const baseSatBonus = financialConfig.saturdayBonusPerUnit !== undefined
        ? financialConfig.saturdayBonusPerUnit
        : (financialConfig.bonusPerUnit || 0) * 2;

    const varSaturdayCost =
        (saturdayInstalls * baseSatBonus) +
        (saturdaySp * (financialConfig.bonusPerMulti || 0) * 2) +
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
    // Saturday units are excluded from M-F break even and paid directly.

    const totalInstalls = standardUnits; // M-F only
    const extraUnits = Math.max(0, totalInstalls - breakEvenUnits);

    const bonusPotInstalls = extraUnits * (financialConfig.bonusPerUnit || 0);
    const bonusPotTa = taUnits * (financialConfig.bonusPerTa || 0);
    const bonusPotSp = spUnits * (financialConfig.bonusPerMulti || 0);

    const totalBonusPotential = bonusPotInstalls + bonusPotTa + bonusPotSp;

    // Surplus check
    // "We subtract the 'overhead' (Global Deficit) from the revenue before checking for surplus."
    // `const totalAbsoluteExpenses = groupExpenses + totalVariableCosts;`
    // `const surplus = Math.max(0, totalRevenue - totalAbsoluteExpenses - overhead);`

    const taCost = taUnits * (financialConfig.taPrice || 0); // "Variable Cost" M-F
    const spCost = spUnits * (financialConfig.multiPrice || 0);

    const totalVariableCosts = taCost + spCost + saturdayCost;
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
        // Exclude saturdayInstalls from the UI progress bar to show purely M-F effort
        const baseUnitsDone = stats.unitsDone - saturdayInstalls;
        stats.progressPercent = Math.min(100, (baseUnitsDone / stats.breakEvenUnits) * 100);
    } else {
        stats.progressPercent = 100;
    }

    stats.taUnits = taUnits + saturdayTa;
    stats.spUnits = spUnits + saturdaySp;

    return stats;
};


exports.getMyPayroll = async (req, res) => {
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { team: { include: { activeClientCompany: true } }, activeClientCompany: true }
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

        // 1. Back Office Special Case (Individual view, no overhead calc needed for them usually)
        if (user.role === 'BACK_OFFICE') {
            let config = null;
            if (team?.activeClientCompany?.settings) {
                config = team.activeClientCompany.settings.backOffice;
            } else if (user.activeClientCompany?.settings) {
                config = user.activeClientCompany.settings.backOffice;
            } else {
                config = settings?.financials?.backOffice || {};
            }
            
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

        // 2. Installers/Blowers Logic
        const groupKey = user.role === 'BLOWER' ? 'blowers' : 'installers';
        
        let financialConfig = null;
        if (team?.activeClientCompany?.settings) {
            financialConfig = team.activeClientCompany.settings[groupKey];
        } else if (user.activeClientCompany?.settings) {
            financialConfig = user.activeClientCompany.settings[groupKey];
        }
        if (!financialConfig && settings?.financials) {
            financialConfig = settings.financials[groupKey];
        }

        let activations = [];
        if (teamId && teamId !== 'virtual') {
            if (groupKey === 'blowers') {
                const soplados = await prisma.sopladoInfo.findMany({
                    where: {
                        createdAt: { gte: start, lte: end },
                        teamId: teamId,
                        address: { project: { isDemo: req.isDemo || false } }
                    }
                });
                activations = soplados.map(s => ({
                    isSaturday: s.isSaturday,
                    activationType: 'BP',
                    createdAt: s.createdAt,
                    basePrice: 0
                }));
            } else {
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
        }

        const teamMembers = team ? team.members : [user];

        // --- OVERHEAD CALCULATION (Global Deficit) ---
        let overheadToCover = 0;
        if (groupKey === 'installers') {
            overheadToCover = await require('../services/financialService').getGlobalSupportDeficit(req.isDemo || false);
        }

        const stats = calculateGroupFinancials(activations, financialConfig, teamMembers, overheadToCover, now.getMonth(), now.getFullYear());

        const memberCount = teamMembers.length || 1;
        const myBonus = stats.bonusPool / memberCount;
        const mySaturday = stats.saturdayPay / memberCount;
        const myTotal = (financialConfig?.salary || user.baseSalary) + myBonus + mySaturday;

        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);

        // PRIVACY FILTER
        const filteredStats = { ...stats };
        if (!isAdmin) {
            delete filteredStats.totalRevenue;
            delete filteredStats.netResult;
            delete filteredStats.overheadApplied;
        }

        res.json({
            financials: financialConfig,
            stats: {
                ...filteredStats,
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
    const { startDate, endDate } = req.query; // Removed userId as it's for all
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
            include: { team: { include: { members: true, activeClientCompany: true } }, activeClientCompany: true }
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

        const soplados = await prisma.sopladoInfo.findMany({
            where: {
                createdAt: { gte: start, lte: end },
                address: { project: { isDemo: req.isDemo || false } }
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
        soplados.forEach(s => {
            const tid = s.teamId;
            if (tid) {
                if (!teamActs[tid]) teamActs[tid] = [];
                teamActs[tid].push({
                    isSaturday: s.isSaturday,
                    activationType: 'BP',
                    createdAt: s.createdAt,
                    basePrice: 0
                });
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

            // Determine Role/Group Key
            let groupKey = 'installers'; // Default
            if (user.role === 'BLOWER') groupKey = 'blowers';
            if (user.role === 'BACK_OFFICE') groupKey = 'backOffice';

            // Fetch Config (Per Client Priority)
            let financialConfig = null;
            if (team?.activeClientCompany?.settings) {
                financialConfig = team.activeClientCompany.settings[groupKey];
            } else if (user.activeClientCompany?.settings) {
                financialConfig = user.activeClientCompany.settings[groupKey];
            }
            if (!financialConfig && settings?.financials) {
                financialConfig = settings.financials[groupKey];
            }

            let stats = null;

            if (user.role === 'BACK_OFFICE') {
                // Simplified Back Office Calc
                const baseSalary = financialConfig?.salary || user.baseSalary || 1500;
                stats = { netResult: 0 - baseSalary }; // Cost center initially
            } else if (team) {
                const acts = teamActs[teamId] || [];
                // Calculate stats for the TEAM (shared)
                // We pass 0 overhead here initially, we might adjust later if we want perfect per-row deficit display
                stats = calculateGroupFinancials(acts, financialConfig, team.members, 0, monthForDays, yearForDays);
            } else {
                // Unassigned or Virtual
                const baseSalary = financialConfig?.salary || user.baseSalary || 1500;
                stats = { netResult: 0 - baseSalary };
            }

            return { user, stats, groupKey, financialConfig };
        });

        // Calc Deficit (Global)
        // Filter "Support" types to sum their Net Result. 
        // Note: This logic sums per USER if they are processed individually, 
        // but if they are in a TEAM, `stats` is calculated per TEAM effectively (repeated for members). 
        // We need to be careful not to double count team stats if iterating users.
        // Actually `processedUsers` maps 1:1 to users. 
        // `stats` for team members serves as their "share" view or identical team view.
        // For deficit calc, we should sum UNIQUE teams + independent users.

        const uniqueTeamsProcessed = new Set();
        let netOthers = 0;

        processedUsers.forEach(item => {
            if (item.groupKey !== 'installers') {
                if (item.user.teamId) {
                    if (!uniqueTeamsProcessed.has(item.user.teamId)) {
                        uniqueTeamsProcessed.add(item.user.teamId);
                        netOthers += (item.stats.netResult || 0);
                    }
                } else {
                    netOthers += (item.stats.netResult || 0);
                }
            }
        });

        // "If the total is negative, Installers need to cover that remaining hole."
        const totalDeficit = netOthers < 0 ? Math.abs(netOthers) : 0;

        const summary = processedUsers.map(({ user, stats, groupKey, financialConfig }) => {
            // Determine Base Salary
            // Priority: Config Salary -> User Base Salary -> Default 1500
            const configSalary = financialConfig ? parseFloat(financialConfig.salary) : null;
            const finalBaseSalary = (configSalary !== null && !isNaN(configSalary)) ? configSalary : (user.baseSalary || 1500);

            // Formating directly for frontend table
            const members = user.team?.members?.length || 1;

            // Per-person bonus share
            const shareBonus = (stats && stats.bonusPool) ? (stats.bonusPool / members) : 0;
            const shareSaturday = (stats && stats.saturdayPay) ? (stats.saturdayPay / members) : 0;

            const total = finalBaseSalary + shareBonus + shareSaturday;

            return {
                id: user.id,
                username: user.username,
                role: user.role,

                // Financials (Top Level for Table)
                baseSalary: finalBaseSalary,
                bonus: shareBonus,
                saturday: shareSaturday,
                total: total,

                // Production & Details
                production: {
                    ...stats,
                    type: groupKey,
                    teamName: user.team?.name || 'Sin Equipo',
                    appointmentsDone: stats?.appointmentsDone || 0
                }
            };
        });

        res.json({
            meta: { range: { start, end }, globalDeficit: totalDeficit },
            data: summary
        });

    } catch (error) {
        console.error('Error getting payroll summary:', error);
        res.status(500).json({ message: 'Error fetching payroll summary' });
    }
};
