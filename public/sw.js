const CACHE_NAME = 'reverso-sr-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/store.js',
  '/js/api.js',
  '/js/router.js',
  '/js/notifications.js',
  '/js/components/toast.js',
  '/js/components/modal.js',
  '/js/components/navbar.js',
  '/js/components/word-card.js',
  '/js/components/review-card.js',
  '/js/components/stats-chart.js',
  '/js/pages/login.js',
  '/js/pages/register.js',
  '/js/pages/dashboard.js',
  '/js/pages/review.js',
  '/js/pages/words.js',
  '/js/pages/add-word.js',
  '/js/pages/word-detail.js',
  '/js/pages/stats.js',
  '/js/pages/settings.js',
  '/manifest.json'
];

// ─── INSTALL ───
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Statik dosyalar önbelleğe alınıyor');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE ───
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ───
self.addEventListener('fetch', event => {
  const { request } = event;

  // API istekleri — Network First
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // GET isteklerini önbelleğe al
          if (request.method === 'GET' && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Statik dosyalar — Cache First
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback
      if (request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});

// ─── PUSH NOTIFICATION ───
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};

  const options = {
    body: data.body || 'Çalışma zamanı geldi!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/#/review' },
    actions: [
      { action: 'study', title: '📖 Çalış' },
      { action: 'dismiss', title: 'Sonra' }
    ],
    tag: 'study-reminder',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Reverso SR', options)
  );
});

// ─── NOTIFICATION CLICK ───
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});