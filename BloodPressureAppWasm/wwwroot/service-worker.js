// BloodPressureAppWasm - Service Worker for PWA + Push Notifications
// Handles: offline caching, push notifications, notification clicks, background sync

const CACHE_NAME = 'bp-tracker-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/css/app.css',
  '/_content/MudBlazor/MudBlazor.min.css',
  '/_content/MudBlazor/MudBlazor.min.js'
];

const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0ASXi9Q2TllApOHO19_hwJqJb5qSX8wJ67Fl4xmLCJw_xCyWmysIynboZGic_0qn8ZNhTks4UGp76JT04pcr5w';

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Push Notification Received
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body || 'È ora della tua terapia',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag || `therapy-${data.therapyId}`,
      renotify: true,
      requireInteraction: true,
      data: {
        therapyId: data.therapyId,
        therapyName: data.therapyName,
        dosage: data.dosage,
        url: data.url || '/therapies'
      },
      actions: [
        { action: 'taken', title: '✅ Preso', icon: '/icon-192.png' },
        { action: 'snooze', title: '⏰ Tra 15 min', icon: '/icon-192.png' },
        { action: 'dismiss', title: '❌ Ignora', icon: '/icon-192.png' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Promemoria Terapia', options)
    );
  } catch (e) {
    console.error('Push error:', e);
  }
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const therapyId = event.notification.data?.therapyId;
  const action = event.action;

  // Handle snooze - reschedule notification
  if (action === 'snooze') {
    event.waitUntil(rescheduleNotification(event.notification.data, 15 * 60 * 1000));
    return;
  }

  // Focus or open app
  const url = event.notification.data?.url || '/therapies';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.postMessage({ type: 'THERAPY_REMINDER', therapyId, action });
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(url);
      })
  );
});

// Notification Close Handler
self.addEventListener('notificationclose', (event) => {
  // Log analytics if needed
  console.log('Notification closed:', event.notification.tag);
});

// Background Sync for offline therapy saves
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-therapies') {
    event.waitUntil(syncTherapies());
  }
  if (event.tag === 'sync-bloodpressure') {
    event.waitUntil(syncBloodPressure());
  }
});

// Reschedule notification (snooze)
async function rescheduleNotification(data, delayMs) {
  if (!data || !data.therapyId) return;

  // Schedule via setTimeout in SW (persists across tab close)
  setTimeout(() => {
    self.registration.showNotification('Promemoria Terapia (rinviato)', {
      body: `È ora di prendere: ${data.therapyName} - ${data.dosage}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      renotify: true,
      requireInteraction: true,
      data: data,
      actions: [
        { action: 'taken', title: '✅ Preso' },
        { action: 'snooze', title: '⏰ Tra 15 min' },
        { action: 'dismiss', title: '❌ Ignora' }
      ]
    });
  }, delayMs);
}

// Sync pending therapies from IndexedDB
async function syncTherapies() {
  // Implementation would read from IndexedDB and POST to API
  console.log('Syncing therapies...');
}

// Sync pending blood pressure measurements
async function syncBloodPressure() {
  console.log('Syncing blood pressure...');
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-reminders') {
    event.waitUntil(checkDueReminders());
  }
});

async function checkDueReminders() {
  // Check IndexedDB for therapies with due reminders
  // Show notifications for any due
  console.log('Checking due reminders...');
}

// Message from main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SUBSCRIBE_PUSH') {
    event.waitUntil(subscribeToPush(event.data.vapidPublicKey));
  }
  if (event.data?.type === 'SCHEDULE_LOCAL') {
    scheduleLocalNotification(event.data);
  }
});

// Subscribe to push
async function subscribeToPush(vapidKey) {
  try {
    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey || VAPID_PUBLIC_KEY)
    });

    // Send subscription to server
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    });

    return subscription;
  } catch (e) {
    console.error('Push subscribe error:', e);
  }
}

// Schedule local notification (fallback when no push server)
function scheduleLocalNotification(data) {
  const { therapyName, dosage, delay, therapyId } = data;
  const tag = `therapy-${therapyId}`;

  setTimeout(() => {
    self.registration.showNotification('Promemoria Terapia', {
      body: `È ora di prendere: ${therapyName} - ${dosage}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag,
      renotify: true,
      requireInteraction: true,
      data: { therapyId, therapyName, dosage, url: '/therapies' },
      actions: [
        { action: 'taken', title: '✅ Preso' },
        { action: 'snooze', title: '⏰ Tra 15 min' },
        { action: 'dismiss', title: '❌ Ignora' }
      ]
    });
  }, delay);
}

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