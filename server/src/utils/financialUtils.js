/**
 * Shared logic for calculating group and member financials
 */

exports.calculateGroupFinancials = (activations, financialConfig, teamMembers, overhead = 0, workingDays = 21, teamDietasCost = 0, isIndividualMode = false, userTeamSize = 1, targetUserId = null) => {
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

    // Per Team Expenses (If individual mode, we split the car and gas by the team size)
    const car = (financialConfig.car !== undefined && financialConfig.car !== null) ? parseFloat(financialConfig.car) : 400; // Match Calculator
    const gas = (financialConfig.gas !== undefined && financialConfig.gas !== null) ? parseFloat(financialConfig.gas) : 300; // Match Calculator
    const equipRent = (financialConfig.equipmentRent !== undefined && financialConfig.equipmentRent !== null) ? parseFloat(financialConfig.equipmentRent) : 0;
    
    let perTeamExpenses = car + gas + equipRent;
    if (isIndividualMode && userTeamSize > 0) {
        perTeamExpenses = perTeamExpenses / userTeamSize;
    }

    // Total Fixed Expenses for this Team (or Individual)
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
        let weight = 1;

        if (isIndividualMode && targetUserId) {
            if (act.performerIds && act.performerIds.length > 0) {
                if (!act.performerIds.includes(targetUserId)) return; // Skip if user not involved
                weight = 1 / act.performerIds.length;
            } else {
                // Fallback for old data without performerIds: assume split by team size
                weight = 1 / (userTeamSize || 1);
            }
        }

        const isSaturday = act.isSaturday === true;
        const type = act.activationType || 'BP';

        // Revenue Calculation
        let snapshotRevenue = (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);

        if (snapshotRevenue > 0) {
            totalRevenue += snapshotRevenue * weight;
        } else {
            // Legacy/Fallback using Config Prices
            const pricePerUnitConfig = financialConfig.pricePerUnit || 0;
            const multiRevenue = financialConfig.multiRevenuePrice || 0;
            const taRevenue = financialConfig.taRevenuePrice || 0;
            const mduRevenue = financialConfig.pricePerMDU || 0;

            if (type === 'BP' || type === 'BP_2_FAM') {
                totalRevenue += pricePerUnitConfig * weight;
            } else if (type === 'BR_MULTI') {
                totalRevenue += (pricePerUnitConfig + multiRevenue) * weight;
            } else if (type === 'SDU') {
                totalRevenue += taRevenue * weight;
            } else if (type === 'MDU') {
                totalRevenue += mduRevenue * weight;
            }
        }

        // Stats Counters
        if (isSaturday) {
            stats.counts.saturday += weight;
            if (type === 'BR_MULTI') {
                saturdayInstalls += weight;
                stats.counts.bp += weight;
                const sps = (act.spInstalled || 0);
                saturdaySp += sps * weight;
                stats.counts.mul += sps * weight;
                if (act.taInstalled || (act.taCount && act.taCount > 0)) {
                    saturdayTa += weight;
                    stats.counts.ta += weight;
                } else if (act.mduInstalled) {
                    saturdayMdu += weight;
                    stats.counts.mdu += weight;
                }
            } else if (type === 'BP') {
                saturdayInstalls += weight;
                stats.counts.bp += weight;
            } else if (type === 'BP_2_FAM') {
                saturdayInstalls += weight;
                stats.counts.bif += weight;
            } else if (type === 'SDU') {
                saturdayTa += weight;
                stats.counts.ta += weight;
            } else if (type === 'MDU') {
                saturdayMdu += weight;
                stats.counts.mdu += weight;
            }
            if ((act.taCount > 0 || act.taInstalled) && type !== 'SDU' && type !== 'BR_MULTI') {
                saturdayTa += (act.taCount || 1) * weight;
                stats.counts.ta += (act.taCount || 1) * weight;
            }
        } else {
            // M-F
            if (type === 'BR_MULTI') {
                standardUnits += weight; 
                stats.counts.bp += weight;
                const sps = (act.spInstalled || 0);
                spUnits += sps * weight;
                stats.counts.mul += sps * weight;
                if (act.taInstalled || (act.taCount && act.taCount > 0)) {
                    taUnits += weight;
                    stats.counts.ta += weight;
                } else if (act.mduInstalled) {
                    mduUnits += weight;
                    stats.counts.mdu += weight;
                }
            } else if (type === 'BP') {
                standardUnits += weight;
                stats.counts.bp += weight;
            } else if (type === 'BP_2_FAM') {
                standardUnits += weight;
                stats.counts.bif += weight;
            } else if (type === 'SDU') {
                taUnits += weight;
                stats.counts.ta += weight;
            } else if (type === 'MDU') {
                mduUnits += weight;
                stats.counts.mdu += weight;
            }
            if ((act.taCount > 0 || act.taInstalled) && type !== 'SDU' && type !== 'BR_MULTI') {
                taUnits += (act.taCount || 1) * weight;
                stats.counts.ta += (act.taCount || 1) * weight;
            }
            if (act.mduInstalled && type !== 'MDU' && type !== 'BR_MULTI') {
                mduUnits += weight;
                stats.counts.mdu += weight;
            }
        }

        // Count Repairs
        if (type === 'REPAIR' || act.isRepair) {
            stats.counts.repair += weight;
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
    
    // A. Saturday Pay (Using capture snapshot prices and weights)
    let saturdayCostTotal = 0;
    activations.filter(a => a.isSaturday).forEach(a => {
        let weight = 1;
        if (isIndividualMode && targetUserId) {
            if (a.performerIds && a.performerIds.length > 0) {
                if (!a.performerIds.includes(targetUserId)) return;
                weight = 1 / a.performerIds.length;
            } else {
                weight = 1 / (userTeamSize || 1);
            }
        }
        saturdayCostTotal += (a.saturdayPay || 0) * weight;
    });
    
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
    let revenueMf = 0;
    activations.filter(a => !a.isSaturday).forEach(act => {
        let weight = 1;
        if (isIndividualMode && targetUserId) {
            if (act.performerIds && act.performerIds.length > 0) {
                if (!act.performerIds.includes(targetUserId)) return;
                weight = 1 / act.performerIds.length;
            } else {
                weight = 1 / (userTeamSize || 1);
            }
        }
        const snap = (act.basePrice || 0) + (act.spPrice || 0) + (act.taPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0);
        revenueMf += snap * weight;
    });

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
