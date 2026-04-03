import { precacheAndRoute } from 'workbox-precaching';

// Built-in PWA precaching
precacheAndRoute(self.__WB_MANIFEST || []);

/**
 * Handle incoming Push Notifications
 */
self.addEventListener('push', (event) => {
    let data = { title: 'JOA Technologien', body: 'Nueva notificación' };
    
    try {
        if (event.data) {
            data = event.data.json();
            console.log('Push received:', data);
        }
    } catch (e) {
        data.body = event.data?.text() || data.body;
    }

    const options = {
        body: data.body,
        icon: '/logo.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        data: data.data || {}, // For click handling
        actions: [
            { action: 'open', title: 'Ver Trabajo' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

/**
 * Handle Notification Clicks (Open App)
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Open main app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                return clientList[0].focus();
            }
            return clients.openWindow('/');
        })
    );
});
