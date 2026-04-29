const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

/**
 * Register a new push subscription for the logged-in user
 * POST /api/notifications/subscribe
 */
router.post('/subscribe', async (req, res) => {
    const { endpoint, keys } = req.body;
    const userId = req.userId;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ message: 'Missing subscription details' });
    }

    try {
        // Find existing sub by endpoint to avoids duplicates
        const existing = await prisma.pushSubscription.findUnique({
            where: { endpoint }
        });

        if (existing) {
            // Update user link if someone else logged in on same device
            if (existing.userId !== userId) {
                await prisma.pushSubscription.update({
                    where: { id: existing.id },
                    data: { userId }
                });
            }
            return res.json({ message: 'Subscription updated' });
        }

        // Create new
        const sub = await prisma.pushSubscription.create({
            data: {
                userId,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth
            }
        });

        res.json({ message: 'Subscribed successfully', id: sub.id });
    } catch (error) {
        console.error('Error subscribing:', error);
        res.status(500).json({ message: 'Error saving push subscription' });
    }
});

/**
 * Get notifications for the logged-in user
 * GET /api/notifications
 */
router.get('/', async (req, res) => {
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        const notifications = await prisma.notification.findMany({
            where: {
                OR: [
                    { targetRole: user.role },
                    { createdById: userId } // Maybe they want to see what they sent, or specific targetUserId if added later
                ]
            },
            include: {
                address: {
                    select: { street: true, number: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Error fetching notifications' });
    }
});

/**
 * Mark a notification as read
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Error updating notification' });
    }
});

/**
 * Remove a subscription (on logout)
 * POST /api/notifications/unsubscribe
 */
router.post('/unsubscribe', async (req, res) => {
    const { endpoint } = req.body;
    try {
        await prisma.pushSubscription.delete({ where: { endpoint } });
        res.json({ message: 'Unsubscribed' });
    } catch (e) {
        res.json({ message: 'Sub record not found, already gone' });
    }
});

/**
 * Delete all notifications for the current user
 * DELETE /api/notifications
 */
router.delete('/', async (req, res) => {
    const userId = req.userId;
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        await prisma.notification.deleteMany({
            where: {
                OR: [
                    { targetRole: user.role },
                    { createdById: userId }
                ]
            }
        });

        res.json({ message: 'Notifications cleared' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ message: 'Error clearing notifications' });
    }
});

module.exports = router;
