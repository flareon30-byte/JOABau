const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.logDieta = async (req, res) => {
    const { type } = req.body;
    const userId = req.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isSaturday = today.getDay() === 6;

    if (!['HOTEL', 'CASA'].includes(type)) {
        return res.status(400).json({ message: 'Tipo de dieta inválido' });
    }

    try {
        // 1. Fetch user to get financial settings
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { 
                team: { include: { activeClientCompany: true } },
                activeClientCompany: true
            }
        });

        let baseAmount = type === 'HOTEL' ? 28.0 : 14.0;
        let extra = 0;

        if (isSaturday) {
            let groupKey = user.role === 'BLOWER' ? 'blowers' : (user.role === 'BACK_OFFICE' ? 'backOffice' : 'installers');
            const teamSettings = user.team?.activeClientCompany?.settings;
            const userSettings = user.activeClientCompany?.settings;
            const config = teamSettings?.[groupKey] || userSettings?.[groupKey];
            
            extra = config?.extraSaturday || 40.0; // Use config or 40€ as requested
        }

        const finalAmount = baseAmount + extra;

        const entry = await prisma.dietaLog.upsert({
            where: {
                userId_date: {
                    userId,
                    date: today
                }
            },
            update: { type, amount: finalAmount, isSaturday },
            create: {
                userId,
                date: today,
                type,
                amount: finalAmount,
                isSaturday
            }
        });

        // --- NEW NOTIFICATION FOR SUPER ADMIN ---
        await prisma.notification.create({
            data: {
                type: 'DIETA_LOGGED',
                message: `🍽️ Dieta registrada: ${user.username} ha marcado ${type} para hoy (${finalAmount}€)`,
                createdById: userId,
                targetRole: 'SUPER_ADMIN'
            }
        });

        res.json({ success: true, entry });
    } catch (error) {
        console.error('Error logging dieta:', error);
        res.status(500).json({ message: 'Error al registrar la dieta' });
    }
};

exports.getTodayDieta = async (req, res) => {
    const userId = req.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        // 1. Check for approved vacation today
        const vacation = await prisma.vacationRequest.findFirst({
            where: {
                userId,
                status: 'APPROVED',
                startDate: { lte: today },
                endDate: { gte: today }
            }
        });

        if (vacation) {
            return res.json({ onVacation: true });
        }

        // 2. Check for existing log
        const entry = await prisma.dietaLog.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today
                }
            }
        });

        if (entry) {
            // Fetch current settings to dynamically resolve Saturday extra pay
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: { 
                    team: { include: { activeClientCompany: true } },
                    activeClientCompany: true
                }
            });
            let currentExtraSaturday = 40.0;
            if (user) {
                let groupKey = user.role === 'BLOWER' ? 'blowers' : (user.role === 'BACK_OFFICE' ? 'backOffice' : 'installers');
                const teamSettings = user.team?.activeClientCompany?.settings;
                const userSettings = user.activeClientCompany?.settings;
                const config = teamSettings?.[groupKey] || userSettings?.[groupKey];
                if (config && config.extraSaturday !== undefined && config.extraSaturday !== null) {
                    currentExtraSaturday = parseFloat(config.extraSaturday);
                }
            }

            const base = entry.type === 'HOTEL' ? 28.0 : (entry.type === 'CASA' ? 14.0 : 0.0);
            if (entry.isSaturday) {
                entry.amount = base + currentExtraSaturday;
            } else {
                entry.amount = base;
            }
        }

        res.json(entry);
    } catch (error) {
        console.error('Error fetching today dieta:', error);
        res.status(500).json({ message: 'Error al obtener dieta de hoy' });
    }
};

// Admin: Manual logging/overriding for any user
exports.adminLogDieta = async (req, res) => {
    const { userId, date, type } = req.body;
    
    if (!userId || !date || !type) {
        return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }

    const logDate = new Date(date);
    logDate.setHours(0, 0, 0, 0);
    const isSaturday = logDate.getDay() === 6;

    try {
        if (type === 'DELETE') {
            await prisma.dietaLog.delete({
                where: {
                    userId_date: { userId, date: logDate }
                }
            });
            return res.json({ success: true, message: 'Dieta eliminada' });
        }

        // Fetch user financial settings for the bonus
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { 
                team: { include: { activeClientCompany: true } },
                activeClientCompany: true
            }
        });

        let baseAmount = type === 'HOTEL' ? 28.0 : (type === 'CASA' ? 14.0 : 0.0);
        let extra = 0;

        if (isSaturday && type !== 'DELETE') {
            let groupKey = user.role === 'BLOWER' ? 'blowers' : (user.role === 'BACK_OFFICE' ? 'backOffice' : 'installers');
            const teamSettings = user.team?.activeClientCompany?.settings;
            const userSettings = user.activeClientCompany?.settings;
            const config = teamSettings?.[groupKey] || userSettings?.[groupKey];
            
            extra = config?.extraSaturday || 40.0;
        }

        const finalAmount = baseAmount + extra;

        const entry = await prisma.dietaLog.upsert({
            where: {
                userId_date: { userId, date: logDate }
            },
            update: { type, amount: finalAmount, isSaturday },
            create: { userId, date: logDate, type, amount: finalAmount, isSaturday }
        });
        res.json({ success: true, entry });
    } catch (error) {
        console.error('Admin dieta error:', error);
        res.status(500).json({ message: 'Error al gestionar la dieta' });
    }
};

exports.getUserDietas = async (req, res) => {
    const { userId, startDate, endDate } = req.query;
    if (!userId) return res.status(400).json({ message: 'userId es requerido' });

    // Security: Only allow the user themselves or an admin to view this data
    if (req.userRole !== 'SUPER_ADMIN' && req.userRole !== 'ADMIN' && req.userId !== userId) {
        return res.status(403).json({ message: 'No tienes permiso para ver estas dietas' });
    }

    try {
        const [logs, user] = await Promise.all([
            prisma.dietaLog.findMany({
                where: {
                    userId,
                    date: {
                        gte: startDate ? new Date(startDate) : undefined,
                        lte: endDate ? new Date(endDate) : undefined
                    }
                },
                orderBy: { date: 'asc' }
            }),
            prisma.user.findUnique({
                where: { id: userId },
                include: { 
                    team: { include: { activeClientCompany: true } },
                    activeClientCompany: true
                }
            })
        ]);

        let currentExtraSaturday = 40.0;
        if (user) {
            let groupKey = user.role === 'BLOWER' ? 'blowers' : (user.role === 'BACK_OFFICE' ? 'backOffice' : 'installers');
            const teamSettings = user.team?.activeClientCompany?.settings;
            const userSettings = user.activeClientCompany?.settings;
            const config = teamSettings?.[groupKey] || userSettings?.[groupKey];
            if (config && config.extraSaturday !== undefined && config.extraSaturday !== null) {
                currentExtraSaturday = parseFloat(config.extraSaturday);
            }
        }

        const mappedLogs = logs.map(d => {
            const base = d.type === 'HOTEL' ? 28.0 : (d.type === 'CASA' ? 14.0 : 0.0);
            if (d.isSaturday) {
                return {
                    ...d,
                    amount: base + currentExtraSaturday
                };
            }
            return {
                ...d,
                amount: base
            };
        });

        res.json(mappedLogs);
    } catch (error) {
        console.error('Error fetching user dietas:', error);
        res.status(500).json({ message: 'Error al obtener historial de dietas' });
    }
};
