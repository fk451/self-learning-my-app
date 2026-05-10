const WordsPage = {
  currentPage: 1,
  currentFilter: {},

  async render(container) {
    container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    try {
      const tagsData = await API.getTags();
      const tags = tagsData?.tags || [];

      container.innerHTML = `
        <div class="page words-page">
          <div class="page-header">
            <h1>📝 Kelimelerim</h1>
            <a href="#/add-word" class="btn btn-primary btn-sm">➕ Kelime Ekle</a>
          </div>

          <!-- Filtreler -->
          <div class="filters-bar">
            <div class="search-box">
              <input type="text" id="word-search" placeholder="Kelime ara..." class="input-search">
            </div>
            <select id="filter-mastery" class="select-filter">
              <option value="">Tüm Durumlar</option>
              <option value="new">🆕 Yeni</option>
              <option value="learning">📗 Öğreniliyor</option>
              <option value="reviewing">🔄 Tekrarda</option>
              <option value="mastered">⭐ Uzmanlaşıldı</option>
              <option value="leech">⚠️ Sorunlu</option>
              <option value="relearn">🔁 Yeniden</option>
            </select>
            <select id="filter-tag" class="select-filter">
              <option value="">Tüm Etiketler</option>
              ${tags.map(t => `<option value="${t.name}">${t.name} (${t.word_count})</option>`).join('')}
            </select>
            <select id="filter-sort" class="select-filter">
              <option value="created_at">Eklenme Tarihi</option>
              <option value="word">Alfabetik</option>
              <option value="next_review_at">Sonraki Tekrar</option>
              <option value="total_reviews">Tekrar Sayısı</option>
              <option value="ease_factor">Kolaylık Faktörü</option>
            </select>
          </div>

          <div id="words-list" class="words-grid"></div>

          <div id="words-pagination" class="pagination"></div>
        </div>
      `;

      // Filtre eventleri
      let searchTimeout;
      document.getElementById('word-search').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          this.currentFilter.search = e.target.value;
          this.currentPage = 1;
          this.loadWords();
        }, 400);
      });

      ['filter-mastery', 'filter-tag', 'filter-sort'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
          this.currentFilter.mastery = document.getElementById('filter-mastery').value;
          this.currentFilter.tag = document.getElementById('filter-tag').value;
          this.currentFilter.sort = document.getElementById('filter-sort').value;
          this.currentPage = 1;
          this.loadWords();
        });
      });

      this.loadWords();

    } catch (err) {
      container.innerHTML = `<div class="error-page"><h2>Hata</h2><p>${err.message}</p></div>`;
    }
  },

  async loadWords() {
    const listEl = document.getElementById('words-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    const params = new URLSearchParams();
    params.set('page', this.currentPage);
    params.set('limit', 24);
    if (this.currentFilter.search) params.set('search', this.currentFilter.search);
    if (this.currentFilter.mastery) params.set('mastery', this.currentFilter.mastery);
    if (this.currentFilter.tag) params.set('tag', this.currentFilter.tag);
    if (this.currentFilter.sort) params.set('sort', this.currentFilter.sort);

    try {
      const data = await API.getWords(params.toString());
      if (!data) return;

      if (data.words.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state-inline">
            <p>🔍 Kelime bulunamadı</p>
          </div>
        `;
        document.getElementById('words-pagination').innerHTML = '';
        return;
      }

      listEl.innerHTML = data.words.map(w => WordCard.render(w)).join('');

      // Pagination
      const pag = data.pagination;
      document.getElementById('words-pagination').innerHTML = `
        <div class="pagination-inner">
          <button class="btn btn-sm btn-ghost" ${pag.page <= 1 ? 'disabled' : ''} onclick="WordsPage.goToPage(${pag.page - 1})">← Önceki</button>
          <span class="pagination-info">Sayfa ${pag.page} / ${pag.totalPages} (${pag.total} kelime)</span>
          <button class="btn btn-sm btn-ghost" ${pag.page >= pag.totalPages ? 'disabled' : ''} onclick="WordsPage.goToPage(${pag.page + 1})">Sonraki →</button>
        </div>
      `;

    } catch (err) {
      listEl.innerHTML = `<p class="error-text">Yüklenemedi: ${err.message}</p>`;
    }
  },

  goToPage(page) {
    this.currentPage = page;
    this.loadWords();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

Router.register('/words', (container) => WordsPage.render(container));