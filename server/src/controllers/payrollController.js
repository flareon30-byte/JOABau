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
            },
            include: { 
                team: {
                    include: { members: true }
                } 
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

            // Fetch actual dietas count for the period
            const dietasCount = await prisma.dietaLog.count({
                where: {
                    userId: user.id,
                    date: { gte: startDate, lte: endDate }
                }
            });
            
            // Reconstruct the expected frontend object
            summary.push({
                id: user.id,
                username: user.username,
                role: user.role,
                baseSalary: user.baseSalary || 0,
                bonus: stats.bonusPool || 0,
                saturday: stats.saturdayPay || 0,
                dietaPay: stats.dietasPay || 0,
                dietasCount: dietasCount,
                total: (user.baseSalary || 0) + (stats.bonusPool || 0) + (stats.saturdayPay || 0) + (stats.dietasPay || 0),
                production: {
                    teamName: user.team?.name || 'Sin Equipo',
                    appointmentsDone: (stats.counts?.bp || 0) + (stats.counts?.ta || 0) + (stats.counts?.sp || 0) + (stats.counts?.mdu || 0) + (stats.counts?.repair || 0),
                    totalRevenue: stats.totalRevenue || 0,
                    counts: {
                        bp: stats.counts?.bp || 0,
                        bif: stats.counts?.sp || 0, // Mapping SP to BIF for UI consistency
                        ta: stats.counts?.ta || 0,
                        mul: stats.counts?.mul || 0,
                        mdu: stats.counts?.mdu || 0,
                        repair: stats.counts?.repair || 0
                    }
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
    try {
        let start, end;
        if (req.body.startDate && req.body.endDate) {
            start = new Date(req.body.startDate);
            end = new Date(req.body.endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            // Fallback to the cycle that ended most recently.
            // If today is the 21st, we want the cycle that ended yesterday (on the 20th).
            // So we check the cycle for today - 24 hours.
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dates = getCycleDates(yesterday);
            start = dates.start;
            end = dates.end;
        }

        const month = end.getMonth() + 1;
        const year = end.getFullYear();

        // 1. Fetch Users
        const users = await prisma.user.findMany({
            where: {
                role: { in: ['BLOWER', 'ACTIVATOR', 'BACK_OFFICE', 'PROTOCOL_MANAGER'] }
            },
            include: { 
                team: {
                    include: { members: true }
                } 
            }
        });

        console.log(`[Archive] Guardando Foto Finish del ciclo ${month}/${year} (${start.toISOString().split('T')[0]} al ${end.toISOString().split('T')[0]})...`);

        let count = 0;
        for (const user of users) {
            try {
                const unified = await getUnifiedUserStats(user.id, req.isDemo || false, start, end);
                if (!unified) continue;

                const { stats } = unified;

                const dietasCount = await prisma.dietaLog.count({
                    where: {
                        userId: user.id,
                        date: { gte: start, lte: end }
                    }
                });

                const baseSalary = user.baseSalary || 0;
                const bonus = stats.bonusPool || 0;
                const saturday = stats.saturdayPay || 0;
                const dietaPay = stats.dietasPay || 0;
                const total = baseSalary + bonus + saturday + dietaPay;

                const appointmentsDone = (stats.counts?.bp || 0) + (stats.counts?.ta || 0) + (stats.counts?.sp || 0) + (stats.counts?.mdu || 0) + (stats.counts?.repair || 0);

                await prisma.payrollLog.upsert({
                    where: {
                        userId_month_year: { userId: user.id, month, year }
                    },
                    update: {
                        points: appointmentsDone,
                        pointEarnings: bonus,
                        dietasCount: dietasCount,
                        dietasAmount: dietaPay,
                        saturdayPay: saturday,
                        totalEuros: total,
                        cycleStart: start,
                        cycleEnd: end
                    },
                    create: {
                        userId: user.id,
                        month,
                        year,
                        points: appointmentsDone,
                        pointEarnings: bonus,
                        dietasCount: dietasCount,
                        dietasAmount: dietaPay,
                        saturdayPay: saturday,
                        totalEuros: total,
                        cycleStart: start,
                        cycleEnd: end
                    }
                });
                count++;
            } catch (e) {
                console.error(`[Archive Error] Error for user ${user.username}:`, e);
            }
        }

        res.json({ success: true, message: `Foto finish completada para ${count} trabajadores.` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Error archiving cycle' });
    }
};

exports.getArchiveHistory = async (req, res) => {
    try {
        const { userId: filterUserId } = req.query;
        let logs;

        if (req.userRole === 'SUPER_ADMIN' || req.userRole === 'ADMIN') {
            if (filterUserId && filterUserId !== 'all') {
                logs = await prisma.payrollLog.findMany({
                    where: { userId: filterUserId },
                    include: { user: true },
                    orderBy: [{ year: 'desc' }, { month: 'desc' }]
                });
            } else {
                logs = await prisma.payrollLog.findMany({
                    include: { user: true },
                    orderBy: [{ year: 'desc' }, { month: 'desc' }]
                });
            }
        } else {
            logs = await prisma.payrollLog.findMany({
                where: { userId: req.userId },
                include: { user: true },
                orderBy: [{ year: 'desc' }, { month: 'desc' }]
            });
        }

        res.json(logs);
    } catch (error) {
        console.error('Error fetching payroll history:', error);
        res.status(500).json({ message: 'Error fetching payroll history' });
    }
};
