/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging service worker (background push handler).
 *
 * This runs independently of /sw.js and only handles push notifications.
 * The firebaseConfig values below are PUBLIC client identifiers (not secrets) —
 * safe to embed. A service worker cannot read import.meta.env, so they are inlined.
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBwpYuRIUDWCzVOSq-sVYqPSWPqr2x6ixg',
  authDomain: 'gridironhub-3131.firebaseapp.com',
  projectId: 'gridironhub-3131',
  storageBucket: 'gridironhub-3131.firebasestorage.app',
  messagingSenderId: '99360679814',
  appId: '1:99360679814:web:88d53997e18fcd9dbe6e07',
});

const messaging = firebase.messaging();

// Handle background messages (app not in focus / closed)
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const notification = payload.notification || {};

  const title = notification.title || data.title || 'OSYS';
  const options = {
    body: notification.body || data.message || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || undefined,
    data: { link: data.link || '/' },
  };

  self.registration.showNotification(title, options);
});

// Focus/open the app when a notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && link) {
            client.navigate(link);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }
    })
  );
});
