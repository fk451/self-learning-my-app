const AddWordPage = {
  lookupData: null,

  async render(container) {
    this.lookupData = null;

    container.innerHTML = `
      <div class="page add-word-page">
        <div class="page-header">
          <h1>🔍 Kelime Ara ve Ekle</h1>
        </div>

        <div class="card search-card">
          <form id="search-form" class="search-form">
            <div class="search-input-row">
              <input type="text" id="word-search-input" required
                     placeholder="İngilizce kelime yazın... (örn: ubiquitous)"
                     class="input-lg input-search-word" autocomplete="off" autofocus>
              <button type="submit" class="btn btn-primary btn-lg" id="search-btn">
                🔍 Ara
              </button>
            </div>
          </form>
        </div>

        <div id="lookup-result"></div>
      </div>
    `;

    document.getElementById('search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.searchWord();
    });
  },

  async searchWord() {
    const input = document.getElementById('word-search-input');
    const word = input.value.trim();
    if (!word) return;

    const btn = document.getElementById('search-btn');
    const resultArea = document.getElementById('lookup-result');

    btn.disabled = true;
    btn.innerHTML = '⏳ Aranıyor...';
    resultArea.innerHTML = '<div class="page-loader"><div class="spinner"></div><p class="search-status">Reverso Dictionary\'den aranıyor...</p></div>';

    try {
      const data = await API.lookupWord(word);

      if (!data || !data.success || !data.data) {
        resultArea.innerHTML = `
          <div class="card empty-result">
            <div class="empty-icon">😔</div>
            <h3>Kelime bulunamadı</h3>
            <p>"${word}" için sonuç yok.</p>
          </div>
        `;
        return;
      }

      this.lookupData = data.data;
      this.renderResult(data.data);

    } catch (err) {
      resultArea.innerHTML = `
        <div class="card empty-result">
          <div class="empty-icon">⚠️</div>
          <h3>Arama hatası</h3>
          <p>${err.message}</p>
        </div>
      `;
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🔍 Ara';
    }
  },

  renderResult(data) {
    const resultArea = document.getElementById('lookup-result');
    const cardId = `addword-preview-${Date.now()}`;

    // Veriyi WordDetailCard formatına dönüştür
    const previewWord = {
      id: 'preview',
      word: data.word,
      phonetic: data.phonetic,
      sections: data.sections || [],
      sentence_examples: data.sentence_examples || []
    };

    resultArea.innerHTML = `
      <!-- Kart Önizleme -->
      <div class="card-preview-label">
        <span>👁️ Kart Önizlemesi</span>
        <span class="text-muted">(kaydırarak tüm anlamları görebilirsiniz)</span>
      </div>

      ${WordDetailCard.render(previewWord, { cardId, showActions: false })}

      <!-- Kaynak -->
      ${data.source_url ? `
        <div class="preview-source">
          <a href="${data.source_url}" target="_blank" class="source-link-sm">🔗 Kaynakta aç</a>
        </div>
      ` : ''}

      <!-- Etiket -->
      <div class="card">
        <div class="form-group mb-0">
          <label>🏷️ Etiketler (opsiyonel, virgülle ayırın)</label>
          <input type="text" id="save-tags-input" placeholder="akademik, IELTS, günlük" class="input-search">
        </div>
      </div>

      <!-- Kaydet -->
      <div class="save-actions">
        <button class="btn btn-primary btn-lg btn-block save-word-btn" id="save-word-btn"
                onclick="AddWordPage.saveWord()">
          💾 Kelimeyi Kaydet
        </button>
        <button class="btn btn-secondary btn-lg btn-block" onclick="AddWordPage.clearResult()">
          🔄 Yeni Arama
        </button>
      </div>
    `;

    // Swipe desteği
    setTimeout(() => WordDetailCard.initSwipe(cardId), 100);

    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async saveWord() {
    if (!this.lookupData) return;

    const btn = document.getElementById('save-word-btn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Kaydediliyor...';

    const tagsStr = document.getElementById('save-tags-input')?.value || '';
    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);

    try {
      const payload = {
        word: this.lookupData.word,
        phonetic: this.lookupData.phonetic || null,
        source_url: this.lookupData.source_url || null,
        sections: (this.lookupData.sections || []).map(sec => ({
          section_word: sec.section_word,
          is_base_form: sec.is_base_form,
          pos_groups: sec.pos_groups.map(pg => ({
            pos: pg.pos,
            senses: pg.senses.map(s => ({
              definition: s.definition,
              frequency: s.frequency,
              dialect: s.dialect,
              has_exclamation: s.has_exclamation,
              mention_text: s.mention_text,
              mention_sentence: s.mention_sentence,
              examples: (s.examples || []).map(ex => ({ text: typeof ex === 'string' ? ex : ex.text || ex })),
              translations: (s.translations || []).map(tr => ({ text: typeof tr === 'string' ? tr : tr.text || tr }))
            }))
          }))
        })),
        sentence_examples: (this.lookupData.sentence_examples || []).map(s => ({ text: typeof s === 'string' ? s : s.text || s })),
        tags
      };

      const data = await API.addWord(payload);

      if (data) {
        Toast.show(`"${this.lookupData.word}" kaydedildi! 🎉`, 'success');
        Router.navigate(`/word-detail/${data.wordId}`);
      }
    } catch (err) {
      if (err.message.includes('zaten')) {
        Toast.show('Bu kelime zaten kayıtlı! 📝', 'warning');
      } else {
        Toast.show(err.message, 'error');
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = '💾 Kelimeyi Kaydet';
    }
  },

  clearResult() {
    this.lookupData = null;
    document.getElementById('lookup-result').innerHTML = '';
    document.getElementById('word-search-input').value = '';
    document.getElementById('word-search-input').focus();
  }
};

Router.register('/add-word', (container) => AddWordPage.render(container));