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

module.exports = router;
