const StatsPage = {
  async render(container) {
    container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    try {
      const [dashboard, posData, weeklyData, leechData] = await Promise.all([
        API.getDashboard(),
        API.getPosDistribution(),
        API.getWeeklyStats(4),
        API.getLeeches()
      ]);

      container.innerHTML = `
        <div class="page stats-page">
          <div class="page-header">
            <h1>📊 İstatistikler</h1>
          </div>

          <!-- Genel Özet -->
          <div class="stats-grid">
            <div class="stat-card stat-card-lg">
              <div class="stat-icon">🔥</div>
              <div class="stat-value">${dashboard?.current_streak || 0}</div>
              <div class="stat-label">Günlük Seri</div>
            </div>
            <div class="stat-card stat-card-lg">
              <div class="stat-icon">📚</div>
              <div class="stat-value">${dashboard?.total_words || 0}</div>
              <div class="stat-label">Toplam Kelime</div>
            </div>
            <div class="stat-card stat-card-lg">
              <div class="stat-icon">⭐</div>
              <div class="stat-value">${dashboard?.mastery?.mastered || 0}</div>
              <div class="stat-label">Uzmanlaşıldı</div>
            </div>
            <div class="stat-card stat-card-lg">
              <div class="stat-icon">⚠️</div>
              <div class="stat-value">${dashboard?.mastery?.leech || 0}</div>
              <div class="stat-label">Sorunlu</div>
            </div>
          </div>

          <!-- Mastery Dağılımı -->
          <div class="card">
            <h3 class="card-title">📊 Durum Dağılımı</h3>
            <div class="mastery-chart-container">
              <canvas id="stats-mastery-donut" width="220" height="220"></canvas>
              <div class="mastery-legend">
                <div class="legend-item"><span class="legend-dot" style="background:#8b5cf6"></span> Yeni: ${dashboard?.mastery?.new || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#3b82f6"></span> Öğreniliyor: ${dashboard?.mastery?.learning || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span> Tekrarda: ${dashboard?.mastery?.reviewing || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#10b981"></span> Uzmanlaşıldı: ${dashboard?.mastery?.mastered || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#ef4444"></span> Sorunlu: ${dashboard?.mastery?.leech || 0}</div>
                <div class="legend-item"><span class="legend-dot" style="background:#f97316"></span> Yeniden: ${dashboard?.mastery?.relearn || 0}</div>
              </div>
            </div>
          </div>

          <!-- 4 Haftalık Grafik -->
          <div class="card">
            <h3 class="card-title">📈 Son 4 Hafta</h3>
            <div class="chart-container chart-container-lg">
              <canvas id="stats-monthly-chart" width="500" height="250"></canvas>
            </div>
          </div>

          <!-- POS Dağılımı -->
          ${posData?.distribution && posData.distribution.length > 0 ? `
            <div class="card">
              <h3 class="card-title">🏷️ POS (Part of Speech) Dağılımı</h3>
              <div class="pos-table-container">
                <table class="data-table">
                  <thead>
                    <tr><th>POS</th><th>Toplam</th><th>Yeni</th><th>Öğreniliyor</th><th>Tekrarda</th><th>Uzman</th><th>Sorunlu</th></tr>
                  </thead>
                  <tbody>
                    ${posData.distribution.map(p => `
                      <tr>
                        <td><strong>${p.pos || 'Belirsiz'}</strong></td>
                        <td>${p.total}</td>
                        <td>${p.new_count || 0}</td>
                        <td>${p.learning_count || 0}</td>
                        <td>${p.reviewing_count || 0}</td>
                        <td>${p.mastered_count || 0}</td>
                        <td>${p.leech_count || 0}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <!-- Leech Kelimeler -->
          ${leechData?.leeches && leechData.leeches.length > 0 ? `
            <div class="card">
              <div class="card-title-row">
                <h3 class="card-title">⚠️ Sorunlu Kelimeler</h3>
                <a href="#/review?type=leech_drill" class="btn btn-sm btn-warning">🎯 Leech Drill</a>
              </div>
              <div class="leech-table-container">
                <table class="data-table">
                  <thead>
                    <tr><th>Kelime</th><th>Lapse</th><th>Ease</th><th>Tekrar</th><th>Doğruluk</th></tr>
                  </thead>
                  <tbody>
                    ${leechData.leeches.map(l => `
                      <tr onclick="Router.navigate('/word-detail/${l.id}')" class="clickable-row">
                        <td><strong>${l.word}</strong></td>
                        <td class="text-danger">${l.lapse_count}</td>
                        <td>${parseFloat(l.ease_factor).toFixed(2)}</td>
                        <td>${l.total_reviews}</td>
                        <td>${l.accuracy || 0}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      `;

      // Grafikleri çiz
      setTimeout(() => {
        if (dashboard?.mastery) {
          StatsChart.drawDonut('stats-mastery-donut', [
            { value: dashboard.mastery.new || 0, color: '#8b5cf6' },
            { value: dashboard.mastery.learning || 0, color: '#3b82f6' },
            { value: dashboard.mastery.reviewing || 0, color: '#f59e0b' },
            { value: dashboard.mastery.mastered || 0, color: '#10b981' },
            { value: dashboard.mastery.leech || 0, color: '#ef4444' },
            { value: dashboard.mastery.relearn || 0, color: '#f97316' }
          ]);
        }

        if (weeklyData?.stats && weeklyData.stats.length > 0) {
          const labels = weeklyData.stats.map(d => {
            const date = new Date(d.stat_date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
          });

          StatsChart.drawBarChart('stats-monthly-chart', labels, [
            { data: weeklyData.stats.map(d => d.words_studied || 0), color: '#6366f1' }
          ]);
        }
      }, 150);

    } catch (err) {
      container.innerHTML = `<div class="error-page"><h2>Hata</h2><p>${err.message}</p></div>`;
    }
  }
};

Router.register('/stats', (container) => StatsPage.render(container));