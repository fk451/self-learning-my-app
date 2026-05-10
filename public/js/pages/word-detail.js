const WordDetailPage = {
  async render(container, wordId) {
    container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    try {
      const word = await API.getWord(wordId);
      if (!word) {
        container.innerHTML = '<div class="error-page"><h2>Kelime bulunamadı</h2></div>';
        return;
      }

      const accuracy = word.total_reviews > 0
        ? Math.round(word.correct_count * 100 / word.total_reviews) : 0;

      const masteryLabels = {
        new: '🆕 Yeni', learning: '📗 Öğreniliyor', reviewing: '🔄 Tekrarda',
        mastered: '⭐ Uzmanlaşıldı', leech: '⚠️ Sorunlu', relearn: '🔁 Yeniden Öğrenme'
      };

      container.innerHTML = `
        <div class="page word-detail-page">
          <div class="page-header">
            <button class="btn btn-ghost" onclick="history.back()">← Geri</button>
            <div class="header-actions">
              <button class="btn btn-sm btn-danger" onclick="WordDetailPage.deleteWord(${word.id}, '${word.word}')">🗑️ Sil</button>
            </div>
          </div>

          <!-- Kelime Başlığı -->
          <div class="detail-hero">
            <h1 class="detail-word">${word.word}</h1>
            ${word.phonetic ? `<p class="detail-phonetic">${word.phonetic}</p>` : ''}
            <span class="mastery-badge mastery-${word.mastery_level}">${masteryLabels[word.mastery_level]}</span>
          </div>

          <!-- İstatistikler -->
          <div class="detail-stats">
            <div class="detail-stat">
              <span class="detail-stat-value">${word.total_reviews}</span>
              <span class="detail-stat-label">Tekrar</span>
            </div>
            <div class="detail-stat">
              <span class="detail-stat-value">${accuracy}%</span>
              <span class="detail-stat-label">Doğruluk</span>
            </div>
            <div class="detail-stat">
              <span class="detail-stat-value">${word.streak}</span>
              <span class="detail-stat-label">Seri</span>
            </div>
            <div class="detail-stat">
              <span class="detail-stat-value">${word.best_streak}</span>
              <span class="detail-stat-label">En İyi Seri</span>
            </div>
            <div class="detail-stat">
              <span class="detail-stat-value">${word.lapse_count}</span>
              <span class="detail-stat-label">Lapse</span>
            </div>
            <div class="detail-stat">
              <span class="detail-stat-value">${parseFloat(word.ease_factor).toFixed(2)}</span>
              <span class="detail-stat-label">Ease</span>
            </div>
          </div>

          <!-- Tarihler -->
          <div class="card">
            <h3 class="card-title">📅 Tarihler</h3>
            <div class="detail-dates">
              <div><strong>Eklenme:</strong> ${formatDate(word.created_at)}</div>
              <div><strong>Son Tekrar:</strong> ${word.last_reviewed_at ? formatDate(word.last_reviewed_at) : 'Henüz çalışılmadı'}</div>
              <div><strong>Sonraki Tekrar:</strong> ${word.next_review_at ? formatDate(word.next_review_at) : 'Belirlenmedi'}</div>
              <div><strong>Aralık:</strong> ${word.interval_days} gün</div>
            </div>
          </div>

          <!-- Anlamlar -->
          ${word.sections && word.sections.length > 0 ? `
            <div class="card">
              <h3 class="card-title">📖 Anlamlar</h3>
              ${word.sections.map(sec => `
                <div class="detail-section">
                  ${sec.section_word !== word.word ? `<h4 class="section-word">${sec.section_word}</h4>` : ''}
                  ${(sec.pos_groups || []).map(pg => `
                    <div class="detail-pos-group">
                      ${pg.pos ? `<span class="pos-tag pos-tag-lg">${pg.pos}</span>` : ''}
                      ${(pg.senses || []).map(sense => `
                        <div class="detail-sense">
                          <p class="sense-def">${sense.definition}</p>
                          ${sense.frequency ? `<span class="frequency-badge">${sense.frequency}</span>` : ''}
                          ${sense.translations && sense.translations.length > 0 ? `
                            <div class="translation-chips">
                              ${sense.translations.map(t => `<span class="translation-chip">${t.translation || t}</span>`).join('')}
                            </div>
                          ` : ''}
                          ${sense.examples && sense.examples.length > 0 ? `
                            <div class="example-list">
                              ${sense.examples.map(e => `<p class="example-item">"${e.example_text || e}"</p>`).join('')}
                            </div>
                          ` : ''}
                        </div>
                      `).join('')}
                    </div>
                  `).join('')}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- Cümle Örnekleri -->
          ${word.sentence_examples && word.sentence_examples.length > 0 ? `
            <div class="card">
              <h3 class="card-title">💬 Cümle Örnekleri</h3>
              ${word.sentence_examples.map(s => `<p class="sentence-example">"${s.sentence_text}"</p>`).join('')}
            </div>
          ` : ''}

          <!-- Etiketler -->
          ${word.tags && word.tags.length > 0 ? `
            <div class="card">
              <h3 class="card-title">🏷️ Etiketler</h3>
              <div class="tags-list">
                ${word.tags.map(t => `<span class="tag-chip tag-chip-lg" style="--tag-color:${t.color}">${t.name}</span>`).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Review Geçmişi -->
          ${word.review_history && word.review_history.length > 0 ? `
            <div class="card">
              <h3 class="card-title">📊 Son Tekrarlar</h3>
              <div class="review-history-table">
                <table>
                  <thead>
                    <tr><th>Tarih</th><th>Puan</th><th>Sonuç</th><th>Durum</th><th>Ease</th><th>Aralık</th></tr>
                  </thead>
                  <tbody>
                    ${word.review_history.map(r => `
                      <tr class="${r.is_correct ? 'row-correct' : 'row-wrong'}">
                        <td>${formatDate(r.reviewed_at)}</td>
                        <td>${r.quality}/5</td>
                        <td>${r.is_correct ? '✅' : '❌'}</td>
                        <td>${r.new_mastery}</td>
                        <td>${parseFloat(r.new_ease).toFixed(2)}</td>
                        <td>${r.new_interval}g</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          ${word.source_url ? `
            <div class="card">
              <a href="${word.source_url}" target="_blank" rel="noopener" class="source-link">🔗 Kaynak: ${word.source_url}</a>
            </div>
          ` : ''}
        </div>
      `;

    } catch (err) {
      container.innerHTML = `<div class="error-page"><h2>Hata</h2><p>${err.message}</p></div>`;
    }
  },

  async deleteWord(id, word) {
    const confirmed = await Modal.confirm('Kelimeyi Sil', `"${word}" kelimesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`);
    if (!confirmed) return;

    try {
      await API.deleteWord(id);
      Toast.show('Kelime silindi', 'success');
      Router.navigate('/words');
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }
};

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

Router.register('/word-detail', (container, id) => WordDetailPage.render(container, id));