const cron = require('node-cron');
const prisma = require('../prisma');
const { sendPushToRole } = require('../utils/notificationUtils');

// Schedule recordatorio los días 20 de cada mes a las 09:00 AM
exports.initAccommodationAlertJob = () => {
    console.log('[Accommodation Alert] Initializing monthly rental renewal job (every 20th at 09:00)...');
    
    cron.schedule('0 9 20 * *', async () => {
        console.log('[Accommodation Alert] Running monthly rental renewal notification job...');
        try {
            // Get all accommodations
            const accommodations = await prisma.accommodation.findMany({
                include: {
                    residents: {
                        select: {
                            username: true
                        }
                    }
                }
            });

            console.log(`[Accommodation Alert] Found ${accommodations.length} accommodations to notify.`);

            for (const acc of accommodations) {
                const residentList = acc.residents.map(r => r.username.split('@')[0]).join(', ');
                const messageText = `Recordatorio de Pago: Renovación del alquiler para el alojamiento en ${acc.address}.${residentList ? ` Residentes: ${residentList}.` : ''} Por favor, revise el pago antes del vencimiento.`;

                // 1. Create DB Notification for Super Admin
                await prisma.notification.create({
                    data: {
                        type: 'RENTAL_RENEWAL',
                        message: messageText,
                        targetRole: 'SUPER_ADMIN'
                    }
                });

                // 2. Create DB Notification for Admin
                await prisma.notification.create({
                    data: {
                        type: 'RENTAL_RENEWAL',
                        message: messageText,
                        targetRole: 'ADMIN'
                    }
                });

                // 3. Send Push Notifications to Super Admins
                sendPushToRole('SUPER_ADMIN', {
                    title: '🏠 Renovación de Alquiler',
                    body: messageText,
                    data: { url: '/dashboard/accommodations' }
                }).catch(e => console.error('[Push Error] Super Admin:', e.message));

                // 4. Send Push Notifications to Admins
                sendPushToRole('ADMIN', {
                    title: '🏠 Renovación de Alquiler',
                    body: messageText,
                    data: { url: '/dashboard/accommodations' }
                }).catch(e => console.error('[Push Error] Admin:', e.message));
            }

            console.log('[Accommodation Alert] Monthly notifications sent successfully.');
        } catch (error) {
            console.error('[Accommodation Alert] Error in cron job:', error);
        }
    });
};
