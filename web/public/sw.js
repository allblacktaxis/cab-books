// Cab Books – receives train alerts and shows them as phone notifications.
// Nothing is cached here; the app always loads fresh from the website.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Cab Books', {
    body: d.body || 'Train problems at the London terminals.',
    tag: d.tag || 'cab-books-trains',
    renotify: true,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: d.url || '/?tool=trains' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/?tool=trains';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { c.navigate && c.navigate(url); return c.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
