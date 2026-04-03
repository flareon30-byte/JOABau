const webpush = require('web-push');
const prisma = require('../prisma');

// Setup VAPID keys - Fallback to avoid crashing the server if env vars are missing in DO
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    try {
        webpush.setVapidDetails(
            process.env.VAPID_EMAIL || 'mailto:admin@joatechnologien.de',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        console.log('[PUSH] WebPush VAPID initialized successfully.');
    } catch (e) {
        console.error('[PUSH] Failed to initialize VAPID keys:', e.message);
    }
} else {
    console.warn('[PUSH-WARNING] VAPID keys not found in environment. Push notifications are disabled. Server will continue running without them.');
}

/**
 * Sends a push notification to all subscribed devices of a user
 * @param {string} userId - ID of the user to notify
 * @param {object} payload - { title: string, body: string, icon: string, data: object }
 */
exports.sendPushToUser = async (userId, payload) => {
    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId }
        });

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                const pushConfig = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                };

                try {
                    await webpush.sendNotification(pushConfig, JSON.stringify(payload));
                    return { success: true };
                } catch (error) {
                    // If subscription is expired/invalid (404 or 410), delete it
                    if (error.statusCode === 404 || error.statusCode === 410) {
                        await prisma.pushSubscription.delete({ where: { id: sub.id } });
                    }
                    console.error('Push error for sub:', sub.id, error.message);
                    return { success: false, error: error.message };
                }
            })
        );

        return results;
    } catch (error) {
        console.error('Error in sendPushToUser:', error);
        return [];
    }
};

/**
 * Sends a push notification to all members of a team
 * @param {string} teamId - ID of the team to notify
 * @param {object} payload - { title: string, body: string, icon: string, data: object }
 */
exports.sendPushToTeam = async (teamId, payload) => {
    try {
        const members = await prisma.user.findMany({
            where: { teamId },
            select: { id: true }
        });

        return await Promise.all(
            members.map(m => exports.sendPushToUser(m.id, payload))
        );
    } catch (error) {
        console.error('Error in sendPushToTeam:', error);
        return [];
    }
};
