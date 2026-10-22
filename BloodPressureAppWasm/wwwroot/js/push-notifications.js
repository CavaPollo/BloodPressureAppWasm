// BloodPressureAppWasm - Push Notifications JavaScript Module
// Handles: Push API subscription, local notifications via SW, permission management

const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0ASXi9Q2TllApOHO19_hwJqJb5qSX8wJ67Fl4xmLCJw_xCyWmysIynboZGic_0qn8ZNhTks4UGp76JT04pcr5w';

export const pushNotifications = {
    // Verifica supporto Push API
    isSupported: () => {
        return 'serviceWorker' in navigator &&
               'PushManager' in window &&
               'Notification' in window;
    },

    // Richiedi permessi notifiche
    requestPermission: async () => {
        if (!('Notification' in window)) return 'denied';
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied') return 'denied';

        try {
            const permission = await Notification.requestPermission();
            return permission;
        } catch (e) {
            console.error('Permission request error:', e);
            return 'denied';
        }
    },

    // Sottoscrivi a Push API via Service Worker
    subscribe: async (vapidKey = VAPID_PUBLIC_KEY) => {
        if (!pushNotifications.isSupported()) {
            console.warn('Push API not supported');
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Verifica subscription esistente
            let subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                console.log('Existing push subscription found');
                return subscription.toJSON();
            }

            // Crea nuova subscription
            const applicationServerKey = urlBase64ToUint8Array(vapidKey);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey
            });

            console.log('New push subscription created');
            return subscription.toJSON();
        } catch (e) {
            console.error('Push subscribe error:', e);
            return null;
        }
    },

    // Programma notifica locale via Service Worker (funziona anche a tab chiusa)
    scheduleLocal: async (data) => {
        if (!('serviceWorker' in navigator)) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            registration.active?.postMessage({
                type: 'SCHEDULE_LOCAL',
                therapyName: data.therapyName,
                dosage: data.dosage,
                delay: data.delay,
                therapyId: data.therapyId
            });
        } catch (e) {
            console.error('Schedule local notification error:', e);

            // Fallback: setTimeout diretto (solo se tab aperta)
            setTimeout(() => {
                if (Notification.permission === 'granted') {
                    new Notification('Promemoria Terapia', {
                        body: `È ora di prendere: ${data.therapyName} - ${data.dosage}`,
                        icon: '/icon-192.png',
                        badge: '/icon-192.png',
                        tag: `therapy-${data.therapyId}`,
                        renotify: true,
                        requireInteraction: true
                    });
                }
            }, data.delay);
        }
    },

    // Annulla notifica (rimuove tag)
    cancel: async (therapyId) => {
        if (!('serviceWorker' in navigator)) return;

        try {
            const registration = await navigator.serviceWorker.ready;
            const notifications = await registration.getNotifications({
                tag: `therapy-${therapyId}`
            });
            notifications.forEach(n => n.close());
        } catch (e) {
            console.error('Cancel notification error:', e);
        }
    },

    // Ottieni subscription corrente
    getSubscription: async () => {
        if (!('serviceWorker' in navigator)) return null;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            return subscription?.toJSON() || null;
        } catch (e) {
            console.error('Get subscription error:', e);
            return null;
        }
    },

    // Annulla subscription push
    unsubscribe: async () => {
        if (!('serviceWorker' in navigator)) return false;

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                return true;
            }
            return false;
        } catch (e) {
            console.error('Unsubscribe error:', e);
            return false;
        }
    }
};

// Helper: Convert base64 to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Auto-inizializzazione quando DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    if (pushNotifications.isSupported()) {
        // Registra service worker
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                updateViaCache: 'none'
            });
            console.log('SW registered:', registration.scope);

            // Listener per messaggi da SW
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'THERAPY_REMINDER') {
                    // Emetti evento custom per componenti Blazor
                    window.dispatchEvent(new CustomEvent('therapy-reminder', {
                        detail: event.data
                    }));
                }
            });
        } catch (e) {
            console.error('SW registration failed:', e);
        }
    }
});

// Esporta per uso globale (compatibilità)
window.pushNotifications = pushNotifications;