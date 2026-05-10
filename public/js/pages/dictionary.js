const DictionaryPage = {
  currentPage: 1,
  loading: false,
  hasMore: true,
  filters: {},
  selectedWordId: null,

  async render(container) {
    this.currentPage = 1;
    this.hasMore = true;
    this.filters = {};
    this.selectedWordId = null;

    container.innerHTML = `
      <div class="page dictionary-page">
        <div class="page-header">
          <h1>📚 Sözlüğüm</h1>
          <a href="#/add-word" class="btn btn-primary btn-sm">➕ Kelime Ekle</a>
        </div>

        <!-- Filtreler -->
        <div class="filters-bar">
          <div class="search-box">
            <input type="text" id="dict-search" placeholder="Kelime ara..." class="input-search">
          </div>
          <select id="dict-mastery" class="select-filter">
            <option value="">Tüm Durumlar</option>
            <option value="new">🆕 Yeni</option>
            <option value="learning">📗 Öğreniliyor</option>
            <option value="reviewing">🔄 Tekrarda</option>
            <option value="mastered">⭐ Uzmanlaşıldı</option>
            <option value="leech">⚠️ Sorunlu</option>
            <option value="relearn">🔁 Yeniden</option>
          </select>
          <select id="dict-sort" class="select-filter">
            <option value="created_at">Son Eklenen</option>
            <option value="word">A-Z</option>
            <option value="total_reviews">En Çok Tekrar</option>
            <option value="next_review_at">Yaklaşan Tekrar</option>
          </select>
        </div>

        <div id="dict-count" class="dict-count"></div>

        <!-- İki Panel: Sol=Liste, Sağ=Detay Card -->
        <div class="dict-layout">
          <div class="dict-list-panel" id="dict-list-panel">
            <div id="dict-list" class="dict-list"></div>
            <div id="dict-load-more" class="dict-load-more hidden">
              <button class="btn btn-secondary btn-sm" onclick="DictionaryPage.loadMore()">Daha Fazla Yükle ↓</button>
            </div>
            <div id="dict-loader" class="page-loader hidden"><div class="spinner"></div></div>
          </div>

          <div class="dict-detail-panel" id="dict-detail-panel">
            <div class="dict-detail-placeholder" id="dict-detail-placeholder">
              <div class="placeholder-icon">👈</div>
              <p>Detayını görmek için bir kelimeye tıklayın</p>
            </div>
            <div id="dict-detail-content" class="hidden"></div>
          </div>
        </div>
      </div>
    `;

    // Filtre eventleri
    let searchTimeout;
    document.getElementById('dict-search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.filters.search = e.target.value;
        this.resetAndLoad();
      }, 400);
    });

    document.getElementById('dict-mastery').addEventListener('change', (e) => {
      this.filters.mastery = e.target.value;
      this.resetAndLoad();
    });

    document.getElementById('dict-sort').addEventListener('change', (e) => {
      this.filters.sort = e.target.value;
      this.resetAndLoad();
    });

    await this.loadWords();
  },

  resetAndLoad() {
    this.currentPage = 1;
    this.hasMore = true;
    this.selectedWordId = null;
    document.getElementById('dict-list').innerHTML = '';
    document.getElementById('dict-detail-content')?.classList.add('hidden');
    document.getElementById('dict-detail-placeholder')?.classList.remove('hidden');
    this.loadWords();
  },

  async loadWords() {
    if (this.loading || !this.hasMore) return;
    this.loading = true;

    document.getElementById('dict-loader')?.classList.remove('hidden');

    const params = new URLSearchParams();
    params.set('page', this.currentPage);
    params.set('limit', 30);
    if (this.filters.search) params.set('search', this.filters.search);
    if (this.filters.mastery) params.set('mastery', this.filters.mastery);
    if (this.filters.sort) params.set('sort', this.filters.sort);
    params.set('order', this.filters.sort === 'word' ? 'ASC' : 'DESC');

    try {
      const data = await API.getWords(params.toString());
      if (!data) return;

      const pag = data.pagination;
      document.getElementById('dict-count').innerHTML =
        `<span>${pag.total} kelime</span>`;

      this.renderList(data.words);

      this.hasMore = pag.page < pag.totalPages;
      document.getElementById('dict-load-more')?.classList.toggle('hidden', !this.hasMore);

    } catch (err) {
      Toast.show('Yüklenemedi: ' + err.message, 'error');
    } finally {
      this.loading = false;
      document.getElementById('dict-loader')?.classList.add('hidden');
    }
  },

  renderList(words) {
    const listEl = document.getElementById('dict-list');
    if (!listEl) return;

    if (words.length === 0 && this.currentPage === 1) {
      listEl.innerHTML = `
        <div class="dict-empty">
          <p>📖 Henüz kelime yok</p>
          <a href="#/add-word" class="btn btn-primary btn-sm">➕ Kelime Ekle</a>
        </div>
      `;
      return;
    }

    const masteryIcons = {
      new: '🆕', learning: '📗', reviewing: '🔄',
      mastered: '⭐', leech: '⚠️', relearn: '🔁'
    };

    for (const w of words) {
      const accuracy = w.total_reviews > 0
        ? Math.round(w.correct_count * 100 / w.total_reviews) : 0;

      const itemHtml = `
        <div class="dict-item ${this.selectedWordId === w.id ? 'dict-item-active' : ''}"
             data-word-id="${w.id}"
             onclick="DictionaryPage.selectWord(${w.id})">
          <div class="dict-item-main">
            <span class="dict-item-mastery">${masteryIcons[w.mastery_level] || ''}</span>
            <div class="dict-item-info">
              <span class="dict-item-word">${w.word}</span>
              ${w.phonetic ? `<span class="dict-item-phonetic">${w.phonetic}</span>` : ''}
            </div>
          </div>
          <div class="dict-item-stats">
            <span class="dict-item-stat" title="Tekrar">🔄${w.total_reviews}</span>
            <span class="dict-item-stat" title="Doğruluk">🎯${accuracy}%</span>
            <span class="dict-item-stat" title="Seri">🔥${w.streak}</span>
          </div>
          <div class="dict-item-meta">
            ${w.tags ? w.tags.map(t => `<span class="tag-chip-xs" style="--tag-color:${t.color}">${t.name}</span>`).join('') : ''}
            <span class="dict-item-date">${formatRelativeDate(w.created_at)}</span>
          </div>
        </div>
      `;
      listEl.insertAdjacentHTML('beforeend', itemHtml);
    }
  },

  async selectWord(wordId) {
    this.selectedWordId = wordId;

    // Aktif satırı güncelle
    document.querySelectorAll('.dict-item').forEach(el => {
      el.classList.toggle('dict-item-active', parseInt(el.dataset.wordId) === wordId);
    });

    const placeholder = document.getElementById('dict-detail-placeholder');
    const content = document.getElementById('dict-detail-content');

    placeholder?.classList.add('hidden');
    content?.classList.remove('hidden');
    content.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    try {
      // Veritabanından detay çek
      const word = await API.getWord(wordId);
      if (!word) {
        content.innerHTML = '<p class="text-muted">Kelime bulunamadı</p>';
        return;
      }

      const cardId = `dict-detail-card-${word.id}`;
      const accuracy = word.total_reviews > 0
        ? Math.round(word.correct_count * 100 / word.total_reviews) : 0;

      const masteryLabels = {
        new: '🆕 Yeni', learning: '📗 Öğreniliyor', reviewing: '🔄 Tekrarda',
        mastered: '⭐ Uzmanlaşıldı', leech: '⚠️ Sorunlu', relearn: '🔁 Yeniden'
      };

      content.innerHTML = `
        <!-- Kelime Detay Kartı (slider) -->
        ${WordDetailCard.render(word, { cardId, showActions: false })}

        <!-- Ek Bilgiler -->
        <div class="dict-detail-info">
          <div class="dict-detail-stats-grid">
            <div class="dict-dstat">
              <span class="dict-dstat-val">${word.total_reviews}</span>
              <span class="dict-dstat-lbl">Tekrar</span>
            </div>
            <div class="dict-dstat">
              <span class="dict-dstat-val">${accuracy}%</span>
              <span class="dict-dstat-lbl">Doğruluk</span>
            </div>
            <div class="dict-dstat">
              <span class="dict-dstat-val">${word.streak} / ${word.best_streak}</span>
              <span class="dict-dstat-lbl">Seri / En İyi</span>
            </div>
            <div class="dict-dstat">
              <span class="dict-dstat-val">${word.lapse_count}</span>
              <span class="dict-dstat-lbl">Lapse</span>
            </div>
            <div class="dict-dstat">
              <span class="dict-dstat-val">${parseFloat(word.ease_factor || 0).toFixed(2)}</span>
              <span class="dict-dstat-lbl">Ease</span>
            </div>
            <div class="dict-dstat">
              <span class="dict-dstat-val">${word.interval_days || 0}g</span>
              <span class="dict-dstat-lbl">Aralık</span>
            </div>
          </div>

          <div class="dict-detail-dates">
            <span>📅 Eklendi: ${formatDate(word.created_at)}</span>
            <span>📖 Son Tekrar: ${word.last_reviewed_at ? formatDate(word.last_reviewed_at) : 'Henüz yok'}</span>
            <span>⏭️ Sonraki: ${word.next_review_at ? formatDate(word.next_review_at) : '-'}</span>
          </div>

          <span class="mastery-badge mastery-${word.mastery_level}">
            ${masteryLabels[word.mastery_level] || word.mastery_level}
          </span>

          ${word.tags && word.tags.length > 0 ? `
            <div class="dict-detail-tags">
              ${word.tags.map(t => `<span class="tag-chip" style="--tag-color:${t.color}">${t.name}</span>`).join('')}
            </div>
          ` : ''}

          ${word.source_url ? `<a href="${word.source_url}" target="_blank" class="source-link-sm">🔗 Kaynakta aç</a>` : ''}
        </div>

        <div class="dict-detail-actions">
          <button class="btn btn-sm btn-secondary" onclick="Router.navigate('/word-detail/${word.id}')">📖 Tam Detay</button>
          <button class="btn btn-sm btn-danger" onclick="DictionaryPage.deleteWord(${word.id}, '${word.word}')">🗑️ Sil</button>
        </div>
      `;

      // Swipe başlat
      setTimeout(() => WordDetailCard.initSwipe(cardId), 100);

      // Mobilde detay paneline scroll
      if (window.innerWidth <= 768) {
        content.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

    } catch (err) {
      content.innerHTML = `<p class="error-text">Hata: ${err.message}</p>`;
    }
  },

  loadMore() {
    this.currentPage++;
    this.loadWords();
  },

  async deleteWord(id, word) {
    const confirmed = await Modal.confirm('Kelimeyi Sil', `"${word}" silinsin mi?`);
    if (!confirmed) return;

    try {
      await API.deleteWord(id);
      Toast.show('Kelime silindi', 'success');
      this.resetAndLoad();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  }
};

Router.register('/dictionary', (container) => DictionaryPage.render(container));