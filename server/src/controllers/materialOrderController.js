const prisma = require('../prisma');
const { sendPushToUser, sendPushToRole } = require('../utils/notificationUtils');

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

        // --- NEW NOTIFICATION FOR SUPER ADMIN ---
        await prisma.notification.create({
            data: {
                type: 'MATERIAL_ORDER_CREATED',
                message: `🛒 Nuevo pedido de material: ${newOrder.user.username} solicita "${materialDescription.substring(0, 30)}..." - Urgencia: ${timeRemaining}`,
                targetRole: 'SUPER_ADMIN'
            }
        });

        // 🟢 SEND PUSH TO ADMINS
        const pushMsg = `🛒 Nuevo pedido de material: ${newOrder.user.username} solicita "${materialDescription.substring(0, 30)}..." - Urgencia: ${timeRemaining}`;
        sendPushToRole('SUPER_ADMIN', {
            title: 'Nuevo Pedido de Material',
            body: pushMsg,
            data: { url: '/dashboard/material-orders' }
        }).catch(e => console.error("Push error SUPER_ADMIN:", e.message));

        sendPushToRole('ADMIN', {
            title: 'Nuevo Pedido de Material',
            body: pushMsg,
            data: { url: '/dashboard/material-orders' }
        }).catch(e => console.error("Push error ADMIN:", e.message));

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

        // Notify user about status change
        let messageText = '';
        if (status === 'EN_ALMACEN') {
            messageText = `📦 Tu material solicitado ("${updatedOrder.materialDescription.substring(0, 30)}...") ya está en el almacén.`;
        } else if (status === 'REALIZADO') {
            messageText = `✅ Tu pedido de material ("${updatedOrder.materialDescription.substring(0, 30)}...") ha sido marcado como realizado.`;
        } else {
            messageText = `⏳ El estado de tu pedido de material ("${updatedOrder.materialDescription.substring(0, 30)}...") ha cambiado a PENDIENTE.`;
        }

        // Create Database Notification targeting the technician's role
        await prisma.notification.create({
            data: {
                type: 'MATERIAL_ORDER_UPDATE',
                message: messageText,
                targetRole: updatedOrder.user.role
            }
        });

        // 🟢 SEND PUSH TO SPECIFIC USER (TECHNICIAN)
        sendPushToUser(updatedOrder.userId, {
            title: '📦 Actualización de Pedido de Material',
            body: messageText,
            data: { url: '/dashboard/material-orders' }
        }).catch(e => console.error("Push error User:", e.message));

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
