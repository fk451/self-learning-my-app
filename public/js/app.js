/**
 * Reverso SR — Ana Uygulama Başlatıcı
 */
(async function () {
  'use strict';

  // ─── Store başlat ───
  Store.init();

  // ─── Service Worker Kayıt ───
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker kayıtlı:', reg.scope);
    } catch (err) {
      console.warn('⚠️ Service Worker kaydedilemedi:', err);
    }
  }

  // ─── Oturum kontrolü ───
  if (Store.isLoggedIn()) {
    try {
      const data = await API.getProfile();
      if (data && data.user) {
        Store.set('user', data.user);
      } else {
        Store.logout();
      }
    } catch {
      // Token geçersiz
      Store.logout();
    }

    // Ayarları çek
    try {
      const settingsData = await API.getSettings();
      if (settingsData?.settings) {
        Store.set('settings', settingsData.settings);
        // Tema uygula
        if (settingsData.settings.theme) {
          Store.set('theme', settingsData.settings.theme);
        }
      }
    } catch { /* Sessiz */ }
  }

  // ─── Navbar ilk render ───
  Navbar.render();

  // ─── Router başlat ───
  Router.init();

  // ─── Bildirim yönetimi başlat ───
  NotificationManager.init();

  // ─── PWA Install Banner ───
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Install banner göster
    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
      <span>📱 Reverso SR'ı ana ekranına ekle!</span>
      <button class="btn btn-sm btn-primary" id="install-btn">Yükle</button>
      <button class="btn btn-sm btn-ghost" onclick="this.parentElement.remove()">✕</button>
    `;
    document.body.appendChild(banner);

    document.getElementById('install-btn').addEventListener('click', async () => {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        Toast.show('Uygulama yükleniyor! 📱', 'success');
      }
      banner.remove();
      deferredPrompt = null;
    });
  });

  // ─── Online/Offline Durum ───
  window.addEventListener('online', () => {
    Toast.show('Bağlantı geri geldi 🌐', 'success');
  });

  window.addEventListener('offline', () => {
    Toast.show('Çevrimdışı moddasınız 📴', 'warning');
  });

  console.log('📚 Reverso SR başlatıldı');
})();