/* Push notifications (imported by Workbox service worker) */
self.addEventListener('push', (event) => {
  let payload = { title: 'Новое объявление', body: '', url: '/announcements' };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: payload.url || '/announcements' },
    tag: payload.tag || 'announcement',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Объявление', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/announcements';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
