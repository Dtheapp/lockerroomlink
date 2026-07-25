const CACHE_NAME = 'osys-v6';
const OFFLINE_URL = '/offline.html';

// Only list assets that actually exist. cache.addAll() rejects as a unit, so a
// single 404 fails the whole install and leaves this worker inactive.
const OFFLINE_ASSETS = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// ---------------------------------------------------------------------------
// Firebase Cloud Messaging (push notifications)
//
// This lives in the SAME worker as the PWA logic on purpose. A scope can only
// have one registration, so registering a separate /firebase-messaging-sw.js at
// scope "/" replaced this worker (and vice versa) on every page load. Whichever
// lost the race meant push events landed in a worker with no push handler and
// were silently dropped.
// ---------------------------------------------------------------------------
let messaging = null;
try {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

  // Public client identifiers, not secrets. A service worker cannot read
  // import.meta.env, so they are inlined.
  firebase.initializeApp({
    apiKey: 'AIzaSyBwpYuRIUDWCzVOSq-sVYqPSWPqr2x6ixg',
    authDomain: 'gridironhub-3131.firebaseapp.com',
    projectId: 'gridironhub-3131',
    storageBucket: 'gridironhub-3131.firebasestorage.app',
    messagingSenderId: '99360679814',
    appId: '1:99360679814:web:88d53997e18fcd9dbe6e07'
  });

  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const notification = payload.notification || {};
    const title = notification.title || data.title || 'OSYS';

    self.registration.showNotification(title, {
      body: notification.body || data.message || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || undefined,
      data: { link: data.link || '/' }
    });
  });
} catch (error) {
  console.warn('[SW] FCM unavailable:', error);
}

// Focus or open the app when a notification is tapped.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && link) client.navigate(link);
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(link);
    })
  );
});

// Install event - cache offline assets individually so one miss can't fail install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        OFFLINE_ASSETS.map((asset) =>
          cache.add(asset).catch((error) => {
            console.warn('[SW] Could not cache', asset, error);
          })
        )
      )
    )
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up ALL old caches aggressively
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - NETWORK ONLY for app, cache only for offline fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip non-http(s) requests
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;

  // For navigation requests (page loads) - ALWAYS go to network
  // Only show offline page if network completely fails
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // For JS/CSS chunks - ALWAYS network, no caching
  // This prevents stale chunk errors
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.includes('/assets/')
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For static assets (icons, manifest) - cache with network fallback
  if (OFFLINE_ASSETS.some(asset => url.pathname.endsWith(asset.replace('/', '')))) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  // Everything else - just use network
  // Don't cache anything else to avoid stale data
});

// Handle skip waiting message
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
