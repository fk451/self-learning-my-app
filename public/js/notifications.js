/**
 * Push Notification Yönetimi
 */
const NotificationManager = {
  async init() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('Push bildirimleri desteklenmiyor');
      return;
    }

    // Local bildirim zamanlayıcı
    this.startLocalScheduler();
  },

  async requestPermission() {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  },

  // Basit yerel bildirim zamanlayıcı
  startLocalScheduler() {
    // Her dakika kontrol et
    setInterval(async () => {
      if (!Store.isLoggedIn()) return;
      if (Notification.permission !== 'granted') return;

      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

      try {
        const data = await API.getSchedules();
        if (!data) return;

        for (const schedule of data.schedules) {
          if (!schedule.is_enabled) continue;
          if (schedule.notify_time !== currentTime) continue;

          // Bugünün günü listede mi?
          const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
          const days = schedule.days_of_week.split(',').map(Number);
          if (!days.includes(dayOfWeek)) continue;

          // Bekleyen kelime sayısı yeterli mi?
          const dashboard = await API.getDashboard();
          if (dashboard && dashboard.due_count >= schedule.min_due_words) {
            this.showLocalNotification(
              '📚 Çalışma Zamanı!',
              `${dashboard.due_count} kelime seni bekliyor. Hedefine ulaşmak için şimdi çalış!`
            );
          }
        }
      } catch (err) {
        // Sessizce hata yut
      }
    }, 60000);
  },

  showLocalNotification(title, body) {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: 'study-reminder',
        renotify: true,
        vibrate: [200, 100, 200]
      });
    }
  }
};