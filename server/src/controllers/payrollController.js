const prisma = require('../prisma');
const { getUnifiedUserStats } = require('../services/performanceService');
const { getCycleDates } = require('../utils/financialUtils');

exports.getCycleDates = getCycleDates;

exports.getMyPayroll = async (req, res) => {
    const userId = req.params.userId || req.userId;
    try {
        const unified = await getUnifiedUserStats(userId, req.isDemo || false);
        if (!unified) return res.status(404).json({ message: 'User not found' });

        const { user, stats, cycle, activations } = unified;

        res.json({
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                salary: user.salary,
                team: user.team
            },
            cycle: {
                start: cycle.start,
                end: cycle.end,
                monthName: cycle.end.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
            },
            summary: {
                baseSalary: user.salary || 0,
                variableEarnings: stats.bonusPool + stats.saturdayPay + stats.dietasPay,
                totalBeforeTaxes: (user.salary || 0) + stats.bonusPool + stats.saturdayPay + stats.dietasPay,
                bonusFromProduction: stats.bonusPool,
                saturdayExtras: stats.saturdayPay,
                dietasExtras: stats.dietasPay,
                progressPercent: stats.progressPercent,
                targetRevenue: stats.totalTargetRevenue,
                currentRevenue: stats.totalRevenue
            },
            details: {
                activations: activations,
                counts: stats.counts
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching payroll' });
    }
};

exports.getPayrollSummary = async (req, res) => {
    res.status(501).json({ message: 'Not implemented in this fix' });
};
