const prisma = require('../prisma');

// Get notifications for the user (based on role)
exports.getNotifications = async (req, res) => {
    const userId = req.userId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        // Logic: fetch notifications targeting user's role OR specifically created for a flow relevant to them?
        // Current logic: Notifications have `targetRole`.
        // We fetch where targetRole matches user.role OR targetRole is null (global? probably not).
        // Also admins might see BACK_OFFICE notifications?
        // User request specifically mentions Back Office receiving usage.

        let whereClause = {
            targetRole: user.role
        };

        // Allow ADMIN/SUPER_ADMIN to see BACK_OFFICE notifications too?
        if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
            whereClause = {
                OR: [
                    { targetRole: user.role },
                    { targetRole: 'BACK_OFFICE' }
                ]
            };
        }

        const notifications = await prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: {
                address: {
                    include: { project: true }
                }
            }
        });

        res.json(notifications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
    const { id } = req.params;
    try {
        const notification = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json(notification);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating notification' });
    }
};
