const prisma = require('../prisma');

exports.createOrder = async (req, res) => {
    try {
        const { materialDescription, timeRemaining } = req.body;
        
        if (!materialDescription || !timeRemaining) {
            return res.status(400).json({ error: 'Faltan campos requeridos: materialDescription, timeRemaining' });
        }

        const newOrder = await prisma.materialOrder.create({
            data: {
                userId: req.userId,
                materialDescription,
                timeRemaining,
                status: 'PENDIENTE'
            },
            include: {
                user: { select: { id: true, username: true, role: true } }
            }
        });

        res.status(201).json(newOrder);
    } catch (error) {
        console.error('Error creating material order:', error);
        res.status(500).json({ error: 'Error del servidor al crear el pedido' });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const orders = await prisma.materialOrder.findMany({
            include: {
                user: { select: { id: true, username: true, role: true, team: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(orders);
    } catch (error) {
        console.error('Error fetching material orders:', error);
        res.status(500).json({ error: 'Error del servidor al obtener los pedidos' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['PENDIENTE', 'REALIZADO', 'EN_ALMACEN'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Estado inválido' });
        }

        const updatedOrder = await prisma.materialOrder.update({
            where: { id },
            data: { status },
            include: {
                user: { select: { id: true, username: true, role: true } }
            }
        });

        res.json(updatedOrder);
    } catch (error) {
        console.error('Error updating material order status:', error);
        res.status(500).json({ error: 'Error del servidor al actualizar el estado' });
    }
};

exports.deleteOrder = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.materialOrder.delete({ where: { id } });
        res.json({ message: 'Pedido eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error del servidor al eliminar el pedido' });
    }
};
