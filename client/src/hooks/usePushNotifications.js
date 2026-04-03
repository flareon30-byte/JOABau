import { useEffect } from 'react';
import api from '../api/axios';

const VAPID_PUBLIC_KEY = "BDJCtQmT834ESeEYwwxn3UuR-_NPhyWRpN9UATYquPel8yYNqteyk8Qco3XhFWmrU9lR4zqr47p3HYBzA4VhqS0";

export const usePushNotifications = (userId) => {
    useEffect(() => {
        if (!userId) return;
        subscribeUser();
    }, [userId]);

    const subscribeUser = async () => {
        if (!('serviceWorker' in navigator)) {
            console.log('Service Workers aren\'t supported in this browser.');
            return;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Check if user already subscribed on this device
            let subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                // Not subscribed, or expired. Ask for permission + subscribe.
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
                });
            }

            // Sync with backend (Always sync to refresh link to current userId)
            const subData = JSON.parse(JSON.stringify(subscription));
            await api.post('/api/notifications/subscribe', {
                endpoint: subData.endpoint,
                keys: subData.keys
            });
            console.log('Signal connected to JOA Push Server.');

        } catch (error) {
            if (error.name === 'NotAllowedError') {
                console.warn('User denied push permission.');
            } else {
                console.error('Push Subscription failed:', error);
            }
        }
    };
};

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
