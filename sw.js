// Minimal service worker: exists only to receive Web Push events for the
// student portal (student.html). Deliberately has no 'fetch' handler — it
// does not cache or intercept anything, so it can't affect the rest of the
// site's normal loading behavior.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'LITALK Education', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'LITALK Education';
  const options = {
    body: data.body || '',
    icon: '/img/LITALK-Icon.png',
    badge: '/img/LITALK-Icon.png',
    data: { url: data.url || '/student.html' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focuses an already-open tab if one exists, otherwise opens a new one — the
// URL is resolved relative to this service worker's own origin, so both a
// relative portal path and a full external URL (e.g. a Stripe link) work.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/student.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
