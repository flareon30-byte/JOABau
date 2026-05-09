const prisma = require('../prisma');

/**
 * Calculates weighted revenue and profitability for a group of technicians.
 * Standardizes calculation across Dashboard and Payroll.
 */
function calculateGroupFinancials(
    activations, 
    financialConfig, 
    teamMembers, 
    overheadToCover, 
    workingDays, 
    teamDietasCost = 0, 
    isIndividualMode = false, 
    teamSizeForSplit = 1, 
    specificUserId = null
) {
    const revenueWeights = {
        BP: parseFloat(financialConfig.basePrice) || 145,
        TA: parseFloat(financialConfig.taPrice) || 185,
        SP: parseFloat(financialConfig.spPrice) || 165,
        MDU: parseFloat(financialConfig.mduPrice) || 100,
        REPAIR: parseFloat(financialConfig.repairPrice) || 85
    };

    const teamSize = teamMembers.length;
    const ssRate = (financialConfig.insuranceRate !== undefined && financialConfig.insuranceRate !== null) ? parseFloat(financialConfig.insuranceRate) : 21.50; 
    const sokaBauRate = (financialConfig.sokaBauPercent !== undefined && financialConfig.sokaBauPercent !== null) ? parseFloat(financialConfig.sokaBauPercent) : 15.10;
    const rentPerPerson = (financialConfig.rent !== undefined && financialConfig.rent !== null) ? parseFloat(financialConfig.rent) : 0;
    const materialsPerPerson = (financialConfig.materials !== undefined && financialConfig.materials !== null) ? parseFloat(financialConfig.materials) : 100;

    let totalRevenue = 0;
    let revenueMf = 0;
    let saturdayPay = 0;
    let counts = { bp: 0, ta: 0, sp: 0, mdu: 0, repair: 0, saturday: 0 };

    activations.forEach(act => {
        const performers = act.performerIds || [];
        const performerCount = performers.length || 1;
        
        // Use 1/N for weight if not in individual mode (where activations are already filtered)
        const weight = isIndividualMode ? 1 : (1 / performerCount);

        const type = act.activationType || 'BP';
        const price = revenueWeights[type] || 145;
        const lineRevenue = price * weight;

        totalRevenue += lineRevenue;
        if (!act.isSaturday) revenueMf += lineRevenue;
        else {
            saturdayPay += (50 * weight); // Extra pay for Saturday
            counts.saturday += weight;
        }

        if (type === 'BP') counts.bp += weight;
        else if (type === 'TA') counts.ta += weight;
        else if (type === 'SP') counts.sp += weight;
        else if (type === 'MDU') counts.mdu += weight;
        else if (type === 'REPAIR') counts.repair += weight;
    });

    let totalSalaries = 0;
    let totalInsurance = 0;
    let totalSokaBau = 0;

    teamMembers.forEach(m => {
        const salary = parseFloat(m.baseSalary) || 3200;
        totalSalaries += salary;
        totalInsurance += (salary * ssRate / 100);
        totalSokaBau += (salary * sokaBauRate / 100);
    });

    const totalMaterials = materialsPerPerson * teamSize;
    const totalRent = rentPerPerson * teamSize;
    const totalDietas = teamDietasCost;

    const totalPersonnelExpenses = totalSalaries + totalInsurance + totalSokaBau + totalDietas + totalMaterials + totalRent;
    const totalTargetRevenue = totalPersonnelExpenses + overheadToCover;

    const progressPercent = totalTargetRevenue > 0 ? Math.min(100, (revenueMf / totalTargetRevenue) * 100) : 100;

    const bonusPool = (revenueMf > totalTargetRevenue) ? (revenueMf - totalTargetRevenue) : 0;

    return {
        totalRevenue,
        currentRevenueMf: revenueMf,
        totalTargetRevenue,
        progressPercent,
        bonusPool,
        saturdayPay,
        dietasPay: totalDietas,
        counts,
        expenses: {
            personnel: totalPersonnelExpenses,
            overhead: overheadToCover
        }
    };
}

function getWorkingDays(year, month) {
    let days = 0;
    let date = new Date(year, month, 1);
    while (date.getMonth() === month) {
        if (date.getDay() !== 0 && date.getDay() !== 6) days++;
        date.setDate(date.getDate() + 1);
    }
    return days;
}

/**
 * Shared helper to get cycle dates (21st to 20th)
 */
function getCycleDates(dateInput = new Date()) {
    let date = new Date(dateInput);
    let start, end;
    if (date.getDate() >= 21) {
        start = new Date(date.getFullYear(), date.getMonth(), 21);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 20, 23, 59, 59, 999);
    } else {
        start = new Date(date.getFullYear(), date.getMonth() - 1, 21);
        end = new Date(date.getFullYear(), date.getMonth(), 20, 23, 59, 59, 999);
    }
    return { start, end };
}

module.exports = {
    calculateGroupFinancials,
    getWorkingDays,
    getCycleDates
};
