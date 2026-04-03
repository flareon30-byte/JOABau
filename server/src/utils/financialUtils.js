/**
 * Shared logic for calculating group and member financials
 */

exports.calculateGroupFinancials = (activations, financialConfig, teamMembers, overhead = 0, workingDays = 21) => {
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
        counts: { bp: 0, ta: 0, sp: 0, mdu: 0, saturday: 0 }
    };

    if (!financialConfig) return stats;

    const teamSize = teamMembers.length || 1;
    const pricePerUnit = financialConfig.pricePerUnit || 0;

    // --- 1. EXPENSES (Costs) ---

    // Per Person Expenses (Matching Calculator App.jsx)
    const salary = financialConfig.salary || 1500;
    
    // Calculator Proportional SS: 21.50% and Soka-Bau: 15.10%
    const ssRate = (financialConfig.insuranceRate !== undefined && financialConfig.insuranceRate !== null) ? financialConfig.insuranceRate : 21.50; 
    const insurance = (salary * ssRate / 100);
    
    const sokaBauPercent = (financialConfig.sokaBauPercent !== undefined && financialConfig.sokaBauPercent !== null) ? financialConfig.sokaBauPercent : 15.10;
    const sokaBau = (salary * sokaBauPercent / 100);
    
    const dietasPerDay = (financialConfig.dietasPerDay !== undefined && financialConfig.dietasPerDay !== null) ? financialConfig.dietasPerDay : 0;
    const rent = (financialConfig.rent !== undefined && financialConfig.rent !== null) ? financialConfig.rent : 0;
    const materialsPerPerson = (financialConfig.materials !== undefined && financialConfig.materials !== null) ? financialConfig.materials : 100;
    const totalDietasPerPerson = dietasPerDay * workingDays;

    const perPersonExpenses = salary + insurance + sokaBau + rent + totalDietasPerPerson + materialsPerPerson;

    // Per Team Expenses
    const car = (financialConfig.car !== undefined && financialConfig.car !== null) ? financialConfig.car : 400; // Match Calculator
    const gas = (financialConfig.gas !== undefined && financialConfig.gas !== null) ? financialConfig.gas : 300; // Match Calculator
    const equipRent = (financialConfig.equipmentRent !== undefined && financialConfig.equipmentRent !== null) ? financialConfig.equipmentRent : 0;
    const perTeamExpenses = car + gas + equipRent;

    // Total Fixed Expenses for this Team
    const groupFixedExpenses = (perPersonExpenses * teamSize) + perTeamExpenses;

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
            if (act.taCount > 0 && type !== 'SDU' && type !== 'BR_MULTI') {
                saturdayTa += act.taCount;
                stats.counts.ta += act.taCount;
            }
        } else {
            // M-F
            if (type === 'BR_MULTI') {
                standardUnits++; 
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

    stats.unitsDone = standardUnits + saturdayInstalls; 

    // --- 3. THRESHOLDS & PROGRESS ---

    // Break Even Units: Only covering THIS team's fixed costs
    stats.breakEvenUnits = pricePerUnit > 0 ? Math.ceil(groupFixedExpenses / pricePerUnit) : 0;

    // Bonus Threshold Units: Units needed to cover Fixed Costs + Global Overhead (Deficit)
    const totalDebtToCover = groupFixedExpenses + overhead;
    stats.bonusThresholdUnits = pricePerUnit > 0 ? Math.ceil(totalDebtToCover / pricePerUnit) : 0;

    // --- 4. VARIABLE COSTS (Bonuses & Saturdays) ---

    let bonusCost = 0;
    
    // A. Saturday Pay
    const saturdayDates = new Set();
    activations.filter(a => a.isSaturday).forEach(a => saturdayDates.add(new Date(a.createdAt).toDateString()));
    const saturdaysWorkedCount = saturdayDates.size;

    const fixedSaturdayCost = saturdaysWorkedCount * (financialConfig.saturdayRate || 0) * teamSize;
    const baseSatBonusRate = financialConfig.saturdayBonusPerUnit !== undefined
        ? financialConfig.saturdayBonusPerUnit
        : (financialConfig.bonusPerUnit || 0) * 2;

    const varSaturdayCost =
        (saturdayInstalls * baseSatBonusRate) +
        (saturdaySp * (financialConfig.bonusPerMulti || 0) * 2) +
        (saturdayTa * (financialConfig.bonusPerTa || 0) * 2);

    const saturdayCostTotal = fixedSaturdayCost + varSaturdayCost;
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
    const revenueMf = totalRevenue - (activations.filter(a => a.isSaturday).reduce((sum, act) => {
        // Simple Revenue extraction for Saturday exclusion
        const type = act.activationType || 'BP';
        const price = (financialConfig.pricePerUnit || (type === 'BP' ? 250 : 60)); // Approximate check for safety
        return sum + price;
    }, 0));

    stats.totalTargetRevenue = targetRevenue;
    stats.currentRevenueMf = revenueMf;
    stats.progressPercent = targetRevenue > 0 ? Math.min(100, (revenueMf / targetRevenue) * 100) : 100;

    stats.totalCost = totalAbsoluteExpenses + bonusCost;
    stats.totalRevenue = totalRevenue;
    stats.netResult = totalRevenue - stats.totalCost;

    stats.details.salaryCost = (perPersonExpenses * teamSize);
    stats.details.opCost = perTeamExpenses;
    stats.details.bonusCost = bonusCost;
    stats.details.saturdayCost = saturdayCostTotal;

    stats.taUnits = taUnits + saturdayTa;
    stats.spUnits = spUnits + saturdaySp;

    return stats;
};
