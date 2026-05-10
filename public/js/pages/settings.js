const SettingsPage = {
  async render(container) {
    container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    try {
      const [settingsData, profileData, schedulesData] = await Promise.all([
        API.getSettings(),
        API.getProfile(),
        API.getSchedules()
      ]);

      const s = settingsData?.settings || {};
      const user = profileData?.user || Store.get('user') || {};
      const schedules = schedulesData?.schedules || [];

      container.innerHTML = `
        <div class="page settings-page">
          <div class="page-header"><h1>⚙️ Ayarlar</h1></div>

          <!-- Profil -->
          <div class="card">
            <h3 class="card-title">👤 Profil</h3>
            <form id="profile-form">
              <div class="form-row">
                <div class="form-group">
                  <label>Görünen Ad</label>
                  <input type="text" id="set-displayname" value="${user.display_name || ''}">
                </div>
                <div class="form-group">
                  <label>Günlük Hedef</label>
                  <input type="number" id="set-dailygoal" value="${user.daily_goal || 20}" min="1" max="200">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Zaman Dilimi</label>
                  <input type="text" id="set-timezone" value="${user.timezone || 'Europe/Istanbul'}">
                </div>
                <div class="form-group">
                  <label>Dil</label>
                  <select id="set-lang">
                    <option value="tr" ${user.preferred_lang === 'tr' ? 'selected' : ''}>Türkçe</option>
                    <option value="en" ${user.preferred_lang === 'en' ? 'selected' : ''}>English</option>
                  </select>
                </div>
              </div>
              <button type="submit" class="btn btn-primary">Profili Kaydet</button>
            </form>
          </div>

          <!-- Tema -->
          <div class="card">
            <h3 class="card-title">🎨 Tema</h3>
            <div class="theme-selector">
              <button class="theme-btn ${s.theme === 'light' ? 'active' : ''}" onclick="SettingsPage.setTheme('light')">☀️ Açık</button>
              <button class="theme-btn ${s.theme === 'dark' ? 'active' : ''}" onclick="SettingsPage.setTheme('dark')">🌙 Koyu</button>
              <button class="theme-btn ${s.theme === 'system' ? 'active' : ''}" onclick="SettingsPage.setTheme('system')">💻 Sistem</button>
            </div>
          </div>

          <!-- SR Parametreleri -->
          <div class="card">
            <h3 class="card-title">🧠 Spaced Repetition Parametreleri</h3>
            <p class="card-desc">Bu değerler öğrenme hızınızı ve tekrar aralıklarını kontrol eder.</p>
            <form id="sr-form">
              <div class="form-row">
                <div class="form-group">
                  <label>Günlük Yeni Kart</label>
                  <input type="number" id="sr-newcards" value="${s.new_cards_per_day || 15}" min="1" max="100">
                </div>
                <div class="form-group">
                  <label>Maks Günlük Tekrar</label>
                  <input type="number" id="sr-maxreviews" value="${s.max_reviews_per_day || 150}" min="10" max="500">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Öğrenme Adımları (dk)</label>
                  <input type="text" id="sr-learnsteps" value="${s.learning_steps || '1,10,30,1440,4320'}">
                  <small>Virgülle ayırın. 1440=1gün, 4320=3gün</small>
                </div>
                <div class="form-group">
                  <label>Yeniden Öğrenme Adımları (dk)</label>
                  <input type="text" id="sr-relearnsteps" value="${s.relearn_steps || '1,10,1440'}">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Mezuniyet Aralığı (gün)</label>
                  <input type="number" id="sr-gradint" value="${s.graduating_interval || 1}" min="1" max="30">
                </div>
                <div class="form-group">
                  <label>Kolay Aralık (gün)</label>
                  <input type="number" id="sr-easyint" value="${s.easy_interval || 3}" min="1" max="30">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Başlangıç Ease</label>
                  <input type="number" step="0.05" id="sr-startease" value="${s.starting_ease || 2.30}" min="1.3" max="3.0">
                </div>
                <div class="form-group">
                  <label>Minimum Ease</label>
                  <input type="number" step="0.05" id="sr-minease" value="${s.minimum_ease || 1.50}" min="1.0" max="2.5">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Aralık Çarpanı</label>
                  <input type="number" step="0.05" id="sr-intmod" value="${s.interval_modifier || 0.85}" min="0.5" max="2.0">
                  <small>0.85 = aralıklar %15 kısa</small>
                </div>
                <div class="form-group">
                  <label>Maks Aralık (gün)</label>
                  <input type="number" id="sr-maxint" value="${s.max_interval || 180}" min="30" max="365">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Kolay Bonus</label>
                  <input type="number" step="0.05" id="sr-easybonus" value="${s.easy_bonus || 1.15}" min="1.0" max="2.0">
                </div>
                <div class="form-group">
                  <label>Lapse Cezası (interval ×)</label>
                  <input type="number" step="0.05" id="sr-lapsepen" value="${s.lapse_penalty || 0.25}" min="0.1" max="1.0">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Lapse Ease Cezası</label>
                  <input type="number" step="0.05" id="sr-lapseease" value="${s.lapse_ease_penalty || 0.15}" min="0.05" max="0.5">
                </div>
                <div class="form-group">
                  <label>Leech Eşiği</label>
                  <input type="number" id="sr-leech" value="${s.leech_threshold || 5}" min="3" max="20">
                  <small>Bu kadar lapse → sorunlu kelime</small>
                </div>
              </div>
              <button type="submit" class="btn btn-primary">SR Ayarlarını Kaydet</button>
            </form>
          </div>

          <!-- Quiz Tercihleri -->
          <div class="card">
            <h3 class="card-title">📝 Quiz Tercihleri</h3>
            <form id="quiz-form">
              <div class="form-row">
                <div class="form-group">
                  <label>Quiz Modu</label>
                  <select id="sr-quizmode">
                    <option value="mixed" ${s.quiz_mode === 'mixed' ? 'selected' : ''}>Karışık</option>
                    <option value="definition_to_word" ${s.quiz_mode === 'definition_to_word' ? 'selected' : ''}>Tanım → Kelime</option>
                    <option value="word_to_definition" ${s.quiz_mode === 'word_to_definition' ? 'selected' : ''}>Kelime → Tanım</option>
                    <option value="translation" ${s.quiz_mode === 'translation' ? 'selected' : ''}>Çeviri</option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <label class="checkbox-label">
                  <input type="checkbox" id="sr-phonetic" ${s.show_phonetic ? 'checked' : ''}> Fonetik göster
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="sr-examples" ${s.show_examples ? 'checked' : ''}> Örnekleri göster
                </label>
              </div>
              <button type="submit" class="btn btn-primary">Quiz Ayarlarını Kaydet</button>
            </form>
          </div>

          <!-- Bildirim Zamanlamaları -->
          <div class="card">
            <div class="card-title-row">
              <h3 class="card-title">🔔 Bildirim Zamanlamaları</h3>
              <button class="btn btn-sm btn-secondary" onclick="SettingsPage.addSchedule()">+ Zamanlama Ekle</button>
            </div>
            <div id="schedules-list">
              ${schedules.length === 0 ? '<p class="empty-text">Henüz bildirim zamanlaması yok</p>' :
                schedules.map(sch => `
                  <div class="schedule-item" data-id="${sch.id}">
                    <div class="schedule-info">
                      <span class="schedule-time">${sch.notify_time.slice(0, 5)}</span>
                      <span class="schedule-type">${sch.schedule_type}</span>
                      <span class="schedule-days">${SettingsPage.formatDays(sch.days_of_week)}</span>
                      <span class="schedule-via">${sch.notify_via}</span>
                    </div>
                    <div class="schedule-actions">
                      <label class="toggle-switch">
                        <input type="checkbox" ${sch.is_enabled ? 'checked' : ''}
                          onchange="SettingsPage.toggleSchedule(${sch.id}, this.checked)">
                        <span class="toggle-slider"></span>
                      </label>
                      <button class="btn btn-xs btn-ghost btn-danger"
                        onclick="SettingsPage.deleteSchedule(${sch.id})">🗑️</button>
                    </div>
                  </div>
                `).join('')
              }
            </div>
            <div class="notif-permission-area">
              <button class="btn btn-sm btn-secondary" onclick="SettingsPage.requestNotifPermission()">
                🔔 Bildirim İzni Ver
              </button>
              <span id="notif-permission-status" class="permission-status">
                ${typeof Notification !== 'undefined' ? Notification.permission : 'desteklenmiyor'}
              </span>
            </div>
          </div>

          <!-- Veri Yönetimi -->
          <div class="card">
            <h3 class="card-title">💾 Veri Yönetimi</h3>
            <div class="data-actions">
              <button class="btn btn-secondary" onclick="SettingsPage.exportData()">📤 Verileri Dışa Aktar (JSON)</button>
              <button class="btn btn-danger" onclick="SettingsPage.clearCache()">🗑️ Önbelleği Temizle</button>
            </div>
          </div>
        </div>
      `;

      // ─── Form Event Listener'ları ───

      // Profil
      document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await API.updateProfile({
            display_name: document.getElementById('set-displayname').value,
            daily_goal: parseInt(document.getElementById('set-dailygoal').value),
            timezone: document.getElementById('set-timezone').value,
            preferred_lang: document.getElementById('set-lang').value
          });
          Toast.show('Profil güncellendi ✅', 'success');
        } catch (err) { Toast.show(err.message, 'error'); }
      });

      // SR Ayarları
      document.getElementById('sr-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await API.updateSettings({
            new_cards_per_day: parseInt(document.getElementById('sr-newcards').value),
            max_reviews_per_day: parseInt(document.getElementById('sr-maxreviews').value),
            learning_steps: document.getElementById('sr-learnsteps').value,
            relearn_steps: document.getElementById('sr-relearnsteps').value,
            graduating_interval: parseInt(document.getElementById('sr-gradint').value),
            easy_interval: parseInt(document.getElementById('sr-easyint').value),
            starting_ease: parseFloat(document.getElementById('sr-startease').value),
            minimum_ease: parseFloat(document.getElementById('sr-minease').value),
            interval_modifier: parseFloat(document.getElementById('sr-intmod').value),
            max_interval: parseInt(document.getElementById('sr-maxint').value),
            easy_bonus: parseFloat(document.getElementById('sr-easybonus').value),
            lapse_penalty: parseFloat(document.getElementById('sr-lapsepen').value),
            lapse_ease_penalty: parseFloat(document.getElementById('sr-lapseease').value),
            leech_threshold: parseInt(document.getElementById('sr-leech').value)
          });
          Toast.show('SR ayarları güncellendi ✅', 'success');
        } catch (err) { Toast.show(err.message, 'error'); }
      });

      // Quiz
      document.getElementById('quiz-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await API.updateSettings({
            quiz_mode: document.getElementById('sr-quizmode').value,
            show_phonetic: document.getElementById('sr-phonetic').checked ? 1 : 0,
            show_examples: document.getElementById('sr-examples').checked ? 1 : 0
          });
          Toast.show('Quiz ayarları güncellendi ✅', 'success');
        } catch (err) { Toast.show(err.message, 'error'); }
      });

    } catch (err) {
      container.innerHTML = `<div class="error-page"><h2>Hata</h2><p>${err.message}</p></div>`;
    }
  },

  async setTheme(theme) {
    Store.set('theme', theme);
    try {
      await API.updateSettings({ theme });
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      Toast.show('Tema değiştirildi', 'success');
    } catch (err) { /* Sessiz */ }
  },

  formatDays(daysStr) {
    const names = { 1: 'Pzt', 2: 'Sal', 3: 'Çar', 4: 'Per', 5: 'Cum', 6: 'Cmt', 7: 'Paz' };
    const days = (daysStr || '').split(',').map(Number);
    if (days.length === 7) return 'Her gün';
    if (days.length === 5 && !days.includes(6) && !days.includes(7)) return 'Hafta içi';
    return days.map(d => names[d] || d).join(', ');
  },

  async addSchedule() {
    Modal.show('Yeni Bildirim Zamanlaması', `
      <div class="form-group">
        <label>Saat</label>
        <input type="time" id="new-sched-time" value="09:00">
      </div>
      <div class="form-group">
        <label>Günler</label>
        <input type="text" id="new-sched-days" value="1,2,3,4,5,6,7" placeholder="1-7 arası, virgülle">
      </div>
    `, [
      { id: 'cancel', label: 'İptal', class: 'btn-secondary', handler: () => Modal.hide() },
      { id: 'save', label: 'Kaydet', class: 'btn-primary', handler: async () => {
        try {
          await API.createSchedule({
            notify_time: document.getElementById('new-sched-time').value + ':00',
            days_of_week: document.getElementById('new-sched-days').value
          });
          Modal.hide();
          Toast.show('Zamanlama eklendi ✅', 'success');
          SettingsPage.render(document.getElementById('main-content'));
        } catch (err) { Toast.show(err.message, 'error'); }
      }}
    ]);
  },

  async toggleSchedule(id, enabled) {
    try {
      await API.updateSchedule(id, { is_enabled: enabled ? 1 : 0 });
    } catch (err) { Toast.show(err.message, 'error'); }
  },

  async deleteSchedule(id) {
    const confirmed = await Modal.confirm('Zamanlamayı Sil', 'Bu zamanlamayı silmek istediğinize emin misiniz?');
    if (!confirmed) return;
    try {
      await API.deleteSchedule(id);
      Toast.show('Zamanlama silindi', 'success');
      document.querySelector(`.schedule-item[data-id="${id}"]`)?.remove();
    } catch (err) { Toast.show(err.message, 'error'); }
  },

  async requestNotifPermission() {
    const granted = await NotificationManager.requestPermission();
    document.getElementById('notif-permission-status').textContent = granted ? 'İzin verildi ✅' : 'Reddedildi ❌';
    if (granted) Toast.show('Bildirim izni verildi 🔔', 'success');
  },

  async exportData() {
    try {
      const data = await API.getWords('limit=9999');
      if (!data) return;
      const blob = new Blob([JSON.stringify(data.words, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reverso-sr-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      Toast.show('Veriler dışa aktarıldı 📤', 'success');
    } catch (err) { Toast.show(err.message, 'error'); }
  },

  async clearCache() {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      Toast.show('Önbellek temizlendi 🗑️', 'success');
    }
  }
};

Router.register('/settings', (container) => SettingsPage.render(container));