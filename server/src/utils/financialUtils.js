/**
 * Shared logic for calculating group and member financials
 */

exports.calculateGroupFinancials = (activations, financialConfig, teamMembers, overhead = 0, workingDays = 21, teamDietasCost = 0) => {
    // Defaults
    const stats = {
        totalRevenue: 0,
        totalCost: 0,
        netResult: 0, // Profit
        bonusPool: 0,
        unitsDone: 0,
        breakEvenUnits: 0,
        bonusThresholdUnits: 0, // NEW: Units needed to cover BOTH fixed costs AND global overhead
        progressPercent: 0,
        saturdayPay: 0,
        details: {
            salaryCost: 0,
            opCost: 0,
            bonusCost: 0,
            saturdayCost: 0
        },
        counts: { bp: 0, bif: 0, ta: 0, mul: 0, mdu: 0, repair: 0, saturday: 0 }
    };

    if (!financialConfig) return stats;

    const teamSize = teamMembers.length || 1;
    const pricePerUnit = financialConfig.pricePerUnit || 0;

    // --- 1. EXPENSES (Costs) ---
    let totalSalaries = 0;
    let totalInsurance = 0;
    let totalSokaBau = 0;
    let totalDietas = 0;
    let totalMaterials = 0;
    let totalRent = 0;

    const ssRate = (financialConfig.insuranceRate !== undefined && financialConfig.insuranceRate !== null) ? parseFloat(financialConfig.insuranceRate) : 21.50; 
    const sokaBauRate = (financialConfig.sokaBauPercent !== undefined && financialConfig.sokaBauPercent !== null) ? parseFloat(financialConfig.sokaBauPercent) : 15.10;
    const rentPerPerson = (financialConfig.rent !== undefined && financialConfig.rent !== null) ? parseFloat(financialConfig.rent) : 0;
    const materialsPerPerson = (financialConfig.materials !== undefined && financialConfig.materials !== null) ? parseFloat(financialConfig.materials) : 100;

    teamMembers.forEach(member => {
        const memberSalary = member.baseSalary || 1500.0;
        totalSalaries += memberSalary;
        totalInsurance += (memberSalary * ssRate / 100);
        totalSokaBau += (memberSalary * sokaBauRate / 100);
        totalMaterials += materialsPerPerson;
        totalRent += rentPerPerson;
    });

    totalDietas = teamDietasCost; // Use actual logged dietas cost for the team
    const totalPersonnelExpenses = totalSalaries + totalInsurance + totalSokaBau + totalDietas + totalMaterials + totalRent;

    // Per Team Expenses
    const car = (financialConfig.car !== undefined && financialConfig.car !== null) ? parseFloat(financialConfig.car) : 400; // Match Calculator
    const gas = (financialConfig.gas !== undefined && financialConfig.gas !== null) ? parseFloat(financialConfig.gas) : 300; // Match Calculator
    const equipRent = (financialConfig.equipmentRent !== undefined && financialConfig.equipmentRent !== null) ? parseFloat(financialConfig.equipmentRent) : 0;
    const perTeamExpenses = car + gas + equipRent;

    // Total Fixed Expenses for this Team
    const groupFixedExpenses = totalPersonnelExpenses + perTeamExpenses;

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

        // Revenue Calculation
        const snapshotRevenue = (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);

        if (snapshotRevenue > 0) {
            totalRevenue += snapshotRevenue;
        } else {
            // Legacy/Fallback using Config Prices
            const pricePerUnitConfig = financialConfig.pricePerUnit || 0;
            const multiRevenue = financialConfig.multiRevenuePrice || 0;
            const taRevenue = financialConfig.taRevenuePrice || 0;
            const mduRevenue = financialConfig.pricePerMDU || 0;

            if (type === 'BP' || type === 'BP_2_FAM') {
                totalRevenue += pricePerUnitConfig;
            } else if (type === 'BR_MULTI') {
                totalRevenue += (pricePerUnitConfig + multiRevenue);
            } else if (type === 'SDU') {
                totalRevenue += taRevenue;
            } else if (type === 'MDU') {
                totalRevenue += mduRevenue;
            }
        }

        // Stats Counters
        if (isSaturday) {
            stats.counts.saturday++;
            if (type === 'BR_MULTI') {
                saturdayInstalls++;
                stats.counts.bp++;
                const sps = (act.spInstalled || 0);
                saturdaySp += sps;
                stats.counts.mul += sps;
                if (act.taInstalled || (act.taCount && act.taCount > 0)) {
                    saturdayTa++;
                    stats.counts.ta++;
                } else if (act.mduInstalled) {
                    saturdayMdu++;
                    stats.counts.mdu++;
                }
            } else if (type === 'BP') {
                saturdayInstalls++;
                stats.counts.bp++;
            } else if (type === 'BP_2_FAM') {
                saturdayInstalls++;
                stats.counts.bif++;
            } else if (type === 'SDU') {
                saturdayTa++;
                stats.counts.ta++;
            } else if (type === 'MDU') {
                saturdayMdu++;
                stats.counts.mdu++;
            }
            if ((act.taCount > 0 || act.taInstalled) && type !== 'SDU' && type !== 'BR_MULTI') {
                saturdayTa += (act.taCount || 1);
                stats.counts.ta += (act.taCount || 1);
            }
        } else {
            // M-F
            if (type === 'BR_MULTI') {
                standardUnits++; 
                stats.counts.bp++;
                const sps = (act.spInstalled || 0);
                spUnits += sps;
                stats.counts.mul += sps;
                if (act.taInstalled || (act.taCount && act.taCount > 0)) {
                    taUnits++;
                    stats.counts.ta++;
                } else if (act.mduInstalled) {
                    mduUnits++;
                    stats.counts.mdu++;
                }
            } else if (type === 'BP') {
                standardUnits++;
                stats.counts.bp++;
            } else if (type === 'BP_2_FAM') {
                standardUnits++;
                stats.counts.bif++;
            } else if (type === 'SDU') {
                taUnits++;
                stats.counts.ta++;
            } else if (type === 'MDU') {
                mduUnits++;
                stats.counts.mdu++;
            }
            if ((act.taCount > 0 || act.taInstalled) && type !== 'SDU' && type !== 'BR_MULTI') {
                taUnits += (act.taCount || 1);
                stats.counts.ta += (act.taCount || 1);
            }
            if (act.mduInstalled && type !== 'MDU' && type !== 'BR_MULTI') {
                mduUnits++;
                stats.counts.mdu++;
            }
        }

        // Count Repairs
        if (type === 'REPAIR' || act.isRepair) {
            stats.counts.repair++;
        }
    });

    stats.unitsDone = standardUnits + saturdayInstalls; 

    // --- 3. THRESHOLDS & PROGRESS ---

    // Break Even Units: Only covering THIS team's fixed costs
    stats.breakEvenUnits = pricePerUnit > 0 ? Math.ceil(groupFixedExpenses / pricePerUnit) : 0;

    // Bonus Threshold Units: Units needed to cover Fixed Costs + Global Overhead (Deficit)
    const totalDebtToCover = groupFixedExpenses + overhead;
    stats.bonusThresholdUnits = pricePerUnit > 0 ? Math.ceil(totalDebtToCover / pricePerUnit) : 0;

    // --- 4. VARIABLE COSTS (Bonuses & Saturdays) ---

    let bonusCost = 0;
    
    // A. Saturday Pay (Using capture snapshot prices)
    const saturdayCostTotal = activations
        .filter(a => a.isSaturday)
        .reduce((sum, a) => sum + (a.saturdayPay || 0), 0);
    
    stats.saturdayPay = saturdayCostTotal;

    // B. Production Bonus (M-F)
    // Needs to cover Fixed Costs AND Global Overhead before surplus exists
    const taCostMf = taUnits * (financialConfig.taPrice || 0); 
    const spCostMf = spUnits * (financialConfig.multiPrice || 0);
    const totalVariableCostsMf = taCostMf + spCostMf + saturdayCostTotal;
    const totalAbsoluteExpenses = groupFixedExpenses + totalVariableCostsMf;

    const extraUnits = Math.max(0, standardUnits - stats.breakEvenUnits); // Use fixed break-even for individual extra units count? 
    // Wait, the "surplus" logic is global. 
    const bonusPotInstalls = Math.max(0, standardUnits - stats.bonusThresholdUnits) * (financialConfig.bonusPerUnit || 0);
    const bonusPotTa = taUnits * (financialConfig.bonusPerTa || 0);
    const bonusPotSp = spUnits * (financialConfig.bonusPerMulti || 0);
    const totalBonusPotential = bonusPotInstalls + bonusPotTa + bonusPotSp;

    const surplus = Math.max(0, totalRevenue - totalAbsoluteExpenses - overhead);

    if (totalRevenue > 0 && surplus > 5) {
        bonusCost = Math.floor(Math.min(totalBonusPotential, surplus));
    } else {
        bonusCost = 0;
    }

    stats.bonusPool = bonusCost;

    // --- 5. RESULTS ---
    const targetRevenue = totalDebtToCover; // Salaries + SS + OpCosts + Share of Company Deficit
    // Statistics: Revenue from Monday to Friday only (excludes Saturday)
    const revenueMf = activations
        .filter(a => !a.isSaturday)
        .reduce((sum, act) => {
            const snap = (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);
            return sum + snap;
        }, 0);

    stats.totalTargetRevenue = targetRevenue;
    stats.currentRevenueMf = revenueMf;
    stats.progressPercent = targetRevenue > 0 ? Math.min(100, (revenueMf / targetRevenue) * 100) : 100;

    stats.totalCost = totalAbsoluteExpenses + bonusCost;
    stats.totalRevenue = totalRevenue;
    stats.netResult = totalRevenue - stats.totalCost;

    stats.details.salaryCost = totalPersonnelExpenses;
    stats.details.opCost = perTeamExpenses;
    stats.details.bonusCost = bonusCost;
    stats.details.saturdayCost = saturdayCostTotal;

    stats.taUnits = taUnits + saturdayTa;
    stats.spUnits = spUnits + saturdaySp;

    return stats;
};
