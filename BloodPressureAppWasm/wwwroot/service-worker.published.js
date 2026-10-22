// BloodPressureAppWasm - Production Service Worker with Push Notifications
// Blazor offline caching + Push API support

const CACHE_NAME_PREFIX = 'offline-cache-';
const VAPID_PUBLIC_KEY = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0ASXi9Q2TllApOHO19_hwJqJb5qSX8wJ67Fl4xmLCJw_xCyWmysIynboZGic_0qn8ZNhTks4UGp76JT04pcr5w';

self.importScripts('./service-worker-assets.js');

self.addEventListener('install', event => event.waitUntil(onInstall(event)));
self.addEventListener('activate', event => event.waitUntil(onActivate(event)));
self.addEventListener('fetch', event => event.respondWith(onFetch(event)));
self.addEventListener('push', event => event.waitUntil(onPush(event)));
self.addEventListener('notificationclick', event => event.waitUntil(onNotificationClick(event)));
self.addEventListener('notificationclose', event => console.log('Notification closed:', event.notification.tag));
self.addEventListener('message', event => onMessage(event));

const cacheName = `${CACHE_NAME_PREFIX}${self.assetsManifest.version}`;
const offlineAssetsInclude = [ /\.dll$/, /\.pdb$/, /\.wasm/, /\.html/, /\.js$/, /\.json$/, /\.css$/, /\.woff$/, /\.png$/, /\.jpe?g$/, /\.gif$/, /\.ico$/, /\.blat$/, /\.dat$/, /\.webmanifest$/ ];
const offlineAssetsExclude = [ /^service-worker\.js$/ ];
const base = "/";
const baseUrl = new URL(base, self.origin);
const manifestUrlList = self.assetsManifest.assets.map(asset => new URL(asset.url, baseUrl).href);

async function onInstall(event) {
  console.info('Service worker: Install');
  const assetsRequests = self.assetsManifest.assets
    .filter(asset => offlineAssetsInclude.some(pattern => pattern.test(asset.url)))
    .filter(asset => !offlineAssetsExclude.some(pattern => pattern.test(asset.url)))
    .map(asset => new Request(asset.url, { integrity: asset.hash, cache: 'no-cache' }));
  await caches.open(cacheName).then(cache => cache.addAll(assetsRequests));
  await self.skipWaiting();
}

async function onActivate(event) {
  console.info('Service worker: Activate');
  const cacheKeys = await caches.keys();
  await Promise.all(cacheKeys
    .filter(key => key.startsWith(CACHE_NAME_PREFIX) && key !== cacheName)
    .map(key => caches.delete(key)));
  await self.clients.claim();
}

async function onFetch(event) {
  if (event.request.method !== 'GET') return fetch(event.request);
  if (!event.request.url.startsWith(self.location.origin)) return fetch(event.request);

  const shouldServeIndexHtml = event.request.mode === 'navigate'
    && !manifestUrlList.some(url => url === event.request.url);

  const request = shouldServeIndexHtml ? 'index.html' : event.request;
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  return cachedResponse || fetch(event.request)
    .then(response => {
      if (response.ok) {
        const responseClone = response.clone();
        caches.open(cacheName).then(cache => cache.put(event.request, responseClone));
      }
      return response;
    })
    .catch(() => cachedResponse);
}

async function onPush(event) {
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
        { action: 'taken', title: 'Preso' },
        { action: 'snooze', title: 'Tra 15 min' },
        { action: 'dismiss', title: 'Ignora' }
      ]
    };
    await self.registration.showNotification(data.title || 'Promemoria Terapia', options);
  } catch (e) {
    console.error('Push error:', e);
  }
}

async function onNotificationClick(event) {
  event.notification.close();
  const therapyId = event.notification.data?.therapyId;
  const action = event.action;

  if (action === 'snooze') {
    await rescheduleNotification(event.notification.data, 15 * 60 * 1000);
    return;
  }

  const url = event.notification.data?.url || '/therapies';
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of clientList) {
    if (client.url.includes(self.location.origin) && 'focus' in client) {
      client.postMessage({ type: 'THERAPY_REMINDER', therapyId, action });
      return client.focus();
    }
  }
  return clients.openWindow(url);
}

async function rescheduleNotification(data, delayMs) {
  if (!data || !data.therapyId) return;
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
        { action: 'taken', title: 'Preso' },
        { action: 'snooze', title: 'Tra 15 min' },
        { action: 'dismiss', title: 'Ignora' }
      ]
    });
  }, delayMs);
}

function onMessage(event) {
  if (event.data?.type === 'SUBSCRIBE_PUSH') {
    event.waitUntil(subscribeToPush(event.data.vapidPublicKey));
  }
  if (event.data?.type === 'SCHEDULE_LOCAL') {
    scheduleLocalNotification(event.data);
  }
}

async function subscribeToPush(vapidKey) {
  try {
    const subscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey || VAPID_PUBLIC_KEY)
    });
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
        { action: 'taken', title: 'Preso' },
        { action: 'snooze', title: 'Tra 15 min' },
        { action: 'dismiss', title: 'Ignora' }
      ]
    });
  }, delay);
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}