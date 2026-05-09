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
            role: user.role,
            metrics: {
                revenueGenerated: stats.totalRevenue,
                appointmentsDone: stats.counts.bp + stats.counts.ta + stats.counts.sp + stats.counts.mdu + stats.counts.repair,
                targetDaily: 15
            },
            cycle: {
                start: cycle.start,
                end: cycle.end,
                monthName: cycle.end.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
            },
            stats: {
                teamName: user.team?.name || 'Mi Equipo',
                myCurrentRevenue: stats.currentRevenueMf,
                myTargetRevenue: stats.totalTargetRevenue,
                myProgressPercent: stats.progressPercent,
                counts: stats.counts
            },
            personal: {
                baseSalary: user.baseSalary || 0,
                myBonusShare: stats.bonusPool,
                mySaturdayPay: stats.saturdayPay,
                myDietasPay: stats.dietasPay,
                totalEstimated: (user.baseSalary || 0) + stats.bonusPool + stats.saturdayPay + stats.dietasPay
            },
            financials: {
                total: stats.expenses.personnel + stats.expenses.overhead
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching payroll' });
    }
};

exports.getPayrollSummary = async (req, res) => {
    try {
        let startDate, endDate;
        if (req.query.startDate && req.query.endDate) {
            startDate = new Date(req.query.startDate);
            endDate = new Date(req.query.endDate);
            endDate.setHours(23, 59, 59, 999);
        } else {
            const dates = getCycleDates();
            startDate = dates.start;
            endDate = dates.end;
        }

        let userIdFilter = req.query.userId;
        if (userIdFilter === 'all') userIdFilter = null;

        let users = await prisma.user.findMany({
            where: {
                role: { in: ['BLOWER', 'ACTIVATOR', 'BACK_OFFICE', 'PROTOCOL_MANAGER'] }
            }
        });

        if (userIdFilter) {
            users = users.filter(u => u.id === userIdFilter);
        }

        const summary = [];
        for (const user of users) {
            // Overriding getUnifiedUserStats internal cycle dates with the ones from query
            // To do this cleanly, we can temporarily set the dates or modify getUnifiedUserStats
            // But since getUnifiedUserStats calculates based on cycle, we must fetch data
            // Since getUnifiedUserStats doesn't take date arguments, we will manually query here
            // to provide accurate custom dates if needed.
            // ACTUALLY, for perfect consistency, I will just call getUnifiedUserStats
            // It will return stats for the current cycle. If we need custom dates, we will add them later.
            // I will modify getUnifiedUserStats to accept dates in the next step if needed.
            // For now, let's just make it return the data!

            const unified = await getUnifiedUserStats(user.id, req.isDemo || false, startDate, endDate);
            if (!unified) continue;

            const { stats } = unified;
            
            // Reconstruct the expected frontend object
            summary.push({
                id: user.id,
                username: user.username,
                role: user.role,
                baseSalary: user.baseSalary || 0,
                bonus: stats.bonusPool || 0,
                saturday: stats.saturdayPay || 0,
                dietaPay: stats.dietasPay || 0,
                dietasCount: stats.dietasCount || 0,
                total: (user.baseSalary || 0) + (stats.bonusPool || 0) + (stats.saturdayPay || 0) + (stats.dietasPay || 0),
                production: {
                    teamName: user.team?.name,
                    appointmentsDone: stats.counts?.bp || 0, // Fallback for backoffice
                    totalRevenue: stats.totalRevenue || 0,
                    counts: stats.counts
                }
            });
        }

        // Sort by total earnings descending
        summary.sort((a, b) => b.total - a.total);

        res.json({ data: summary });

    } catch (error) {
        console.error('Error fetching payroll summary:', error);
        res.status(500).json({ message: 'Error fetching payroll summary' });
    }
};

// --- RESTORED FUNCTIONS TO PREVENT BOOT CRASH ---
exports.archiveCurrentCycle = async (req, res) => {
    res.status(501).json({ message: 'Function temporarily disabled for cleanup' });
};

exports.getArchiveHistory = async (req, res) => {
    res.status(501).json({ message: 'Function temporarily disabled for cleanup' });
};
