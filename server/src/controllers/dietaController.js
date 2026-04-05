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
        res.status(500).json({ message: 'Error al obtener dieta de hoy' });
    }
};
