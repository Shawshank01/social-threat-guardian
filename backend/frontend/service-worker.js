self.addEventListener('push', (event) => {
    if (!event.data) return;
    const data = event.data.json?.() || {};
    // data structure same as backend
    const title = data.title || 'notifications';
    const options = {
      body: data.body || '',
      icon: data.icon,
      image: data.image,
      badge: data.badge,
      data: data.data || {}, // URL and etc
      actions: data.actions,  // [{action:'open', title:'open'}]
      tag: data.tag,
      renotify: data.renotify,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  });
  
  // click notification
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification?.data?.url || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // if has opened window, focus it
        for (const client of clientList) { 
          if ('focus' in client) return client.focus();
        }
        // or open new window
        if (clients.openWindow) return clients.openWindow(url);
      })
    );
  });
  