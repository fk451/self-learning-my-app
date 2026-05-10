const DashboardPage = {
  async render(container) {
    container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    try {
      const data = await API.getDashboard();
      if (!data) return;

      const user = Store.get('user');
      const accuracy = (data.today.correct_answers + data.today.wrong_answers) > 0
        ? Math.round(data.today.correct_answers * 100 / (data.today.correct_answers + data.today.wrong_answers))
        : 0;

      const goalProgress = Math.min(100, Math.round((data.today.words_studied / (user?.daily_goal || 20)) * 100));

      container.innerHTML = `
        <div class="page dashboard-page">
          <div class="dashboard-welcome">
            <h1>Merhaba, ${user?.display_name || user?.username || 'Öğrenci'} 👋</h1>
            <p>${getGreetingMessage(data)}</p>
          </div>

          <div class="quick-actions">
            <button class="action-card action-study" onclick="Router.navigate('/review')">
              <span class="action-icon">📖</span>
              <span class="action-text">Çalışmaya Başla</span>
              <span class="action-badge">${data.due_count} kelime bekliyor</span>
            </button>
            <button class="action-card action-add" onclick="Router.navigate('/add-word')">
              <span class="action-icon">➕</span>
              <span class="action-text">Kelime Ekle</span>
            </button>
            <button class="action-card action-leech" onclick="Router.navigate('/review?type=leech_drill')">
              <span class="action-icon">⚠️</span>
              <span class="action-text">Sorunlu Kelimeler</span>
              <span class="action-badge">${data.mastery.leech || 0} kelime</span>
            </button>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">🔥</div>
              <div class="stat-value">${data.current_streak}</div>
              <div class="stat-label">Günlük Seri</div>
            </div>
            <div class="stat-card stat-card-clickable" onclick="Router.navigate('/dictionary')">
              <div class="stat-icon">📚</div>
              <div class="stat-value">${data.total_words}</div>
              <div class="stat-label">Toplam Kelime</div>
              <div class="stat-hint">Tümünü gör →</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">✅</div>
              <div class="stat-value">${data.today.words_studied}</div>
              <div class="stat-label">Bugün Çalışılan</div>
            </div>
            <div class="stat-card">
              <div class="stat-icon">🎯</div>
              <div class="stat-value">${accuracy}%</div>
              <div class="stat-label">Bugün Doğruluk</div>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">📋 Günlük Hedef</h3>
            <div class="goal-progress">
              <div class="goal-bar">
                <div class="goal-fill" style="width: ${goalProgress}%"></div>
              </div>
              <div class="goal-text">
                ${data.today.words_studied} / ${user?.daily_goal || 20} kelime (${goalProgress}%)
              </div>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">📊 Kelime Durumları</h3>
            <div class="mastery-chart-container">
              <canvas id="mastery-donut" width="200" height="200"></canvas>
              <div class="mastery-legend">
                <div class="legend-item"><span class="legend-dot" style="background:#8b5cf6"></span> Yeni: ${data.mastery.new || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#3b82f6"></span> Öğreniliyor: ${data.mastery.learning || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span> Tekrarda: ${data.mastery.reviewing || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span> Uzmanlaşıldı: ${data.mastery.mastered || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#ef4444"></span> Sorunlu: ${data.mastery.leech || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#f97316"></span> Yeniden: ${data.mastery.relearn || 0}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <h3 class="card-title">📈 Son 7 Gün</h3>
            <div class="chart-container">
              <canvas id="weekly-chart" width="400" height="200"></canvas>
            </div>
          </div>
        </div>
      `;

      setTimeout(() => {
        StatsChart.drawDonut('mastery-donut', [
          { value: data.mastery.new || 0, color: '#8b5cf6' },
          { value: data.mastery.learning || 0, color: '#3b82f6' },
          { value: data.mastery.reviewing || 0, color: '#f59e0b' },
          { value: data.mastery.mastered || 0, color: '#10b981' },
          { value: data.mastery.leech || 0, color: '#ef4444' },
          { value: data.mastery.relearn || 0, color: '#f97316' }
        ]);

        if (data.weekly && data.weekly.length > 0) {
          const labels = data.weekly.map(d => {
            const date = new Date(d.stat_date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
          });
          StatsChart.drawBarChart('weekly-chart', labels, [
            { data: data.weekly.map(d => d.correct_answers || 0), color: '#10b981' },
            { data: data.weekly.map(d => d.wrong_answers || 0), color: '#ef4444' }
          ]);
        }
      }, 100);

    } catch (err) {
      container.innerHTML = `<div class="error-page"><h2>Veriler yüklenemedi</h2><p>${err.message}</p></div>`;
    }
  }
};

function getGreetingMessage(data) {
  if (data.due_count === 0) return 'Tebrikler! Bugünlük tüm kelimeleri tamamladınız. 🎉';
  if (data.current_streak >= 7) return `${data.current_streak} günlük seri! Harika gidiyorsun! 🔥`;
  if (data.due_count > 50) return `${data.due_count} kelime birikimiş, hadi başlayalım! 💪`;
  return `Bugün ${data.due_count} kelime seni bekliyor. Hadi çalışalım! 📖`;
}

Router.register('/dashboard', (container) => DashboardPage.render(container));