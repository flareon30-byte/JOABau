const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.logDieta = async (req, res) => {
    const { type } = req.body;
    const userId = req.userId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!['HOTEL', 'CASA'].includes(type)) {
        return res.status(400).json({ message: 'Tipo de dieta inválido' });
    }

    const amount = type === 'HOTEL' ? 28.0 : 14.0;

    try {
        const entry = await prisma.dietaLog.upsert({
            where: {
                userId_date: {
                    userId,
                    date: today
                }
            },
            update: { type, amount },
            create: {
                userId,
                date: today,
                type,
                amount
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
    const amount = type === 'HOTEL' ? 28.0 : (type === 'CASA' ? 14.0 : 0.0);

    try {
        if (type === 'DELETE') {
            await prisma.dietaLog.delete({
                where: {
                    userId_date: { userId, date: logDate }
                }
            });
            return res.json({ success: true, message: 'Dieta eliminada' });
        }

        const entry = await prisma.dietaLog.upsert({
            where: {
                userId_date: { userId, date: logDate }
            },
            update: { type, amount },
            create: { userId, date: logDate, type, amount }
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

    try {
        const logs = await prisma.dietaLog.findMany({
            where: {
                userId,
                date: {
                    gte: startDate ? new Date(startDate) : undefined,
                    lte: endDate ? new Date(endDate) : undefined
                }
            },
            orderBy: { date: 'asc' }
        });
        res.json(logs);
    } catch (error) {
        console.error('Error fetching user dietas:', error);
        res.status(500).json({ message: 'Error al obtener historial de dietas' });
    }
};
