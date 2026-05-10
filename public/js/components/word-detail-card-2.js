/**
 * Evrensel Kelime Detay Kartı — Slider'lı
 * Her yerde kullanılabilir: sözlük, review, ekleme sonrası
 */
const WordDetailCard = {

  /**
   * Kelime verisinden tüm slide'ları oluşturur
   * @param {Object} word - Kelime verisi (sections, pos_groups, senses içeren)
   * @param {Object} options - { showActions: bool, compact: bool, cardId: string }
   * @returns {string} HTML
   */
  render(word, options = {}) {
    const cardId = options.cardId || `wdc-${word.id || Math.random().toString(36).substr(2, 6)}`;
    const slides = this.buildSlides(word);
    const totalSlides = slides.length;

    if (totalSlides === 0) {
      return `
        <div class="wdc" id="${cardId}">
          <div class="wdc-header">
            <h3 class="wdc-word">${word.word}</h3>
            ${word.phonetic ? `<span class="wdc-phonetic">${word.phonetic}</span>` : ''}
          </div>
          <div class="wdc-empty">Henüz anlam verisi yok</div>
        </div>
      `;
    }

    return `
      <div class="wdc ${options.compact ? 'wdc-compact' : ''}" id="${cardId}" data-current-slide="0" data-total-slides="${totalSlides}">

        <!-- Üst Bilgi -->
        <div class="wdc-header">
          <div class="wdc-header-left">
            <h3 class="wdc-word">${word.word}</h3>
            ${word.phonetic ? `<span class="wdc-phonetic">${word.phonetic}</span>` : ''}
          </div>
          ${totalSlides > 1 ? `
            <div class="wdc-slide-indicator">
              <span class="wdc-slide-current" id="${cardId}-slide-num">1</span>
              <span class="wdc-slide-sep">/</span>
              <span class="wdc-slide-total">${totalSlides}</span>
            </div>
          ` : ''}
        </div>

        <!-- Slider Container -->
        <div class="wdc-slider-wrapper">
          ${totalSlides > 1 ? `
            <button class="wdc-nav wdc-nav-prev" onclick="WordDetailCard.prev('${cardId}')" id="${cardId}-prev" disabled>
              ‹
            </button>
          ` : ''}

          <div class="wdc-slider" id="${cardId}-slider">
            <div class="wdc-slides-track" id="${cardId}-track" style="width: ${totalSlides * 100}%;">
              ${slides.map((slide, i) => `
                <div class="wdc-slide" style="width: ${100 / totalSlides}%;">
                  ${slide}
                </div>
              `).join('')}
            </div>
          </div>

          ${totalSlides > 1 ? `
            <button class="wdc-nav wdc-nav-next" onclick="WordDetailCard.next('${cardId}')" id="${cardId}-next">
              ›
            </button>
          ` : ''}
        </div>

        <!-- Dot Göstergeler -->
        ${totalSlides > 1 ? `
          <div class="wdc-dots" id="${cardId}-dots">
            ${slides.map((_, i) => `
              <button class="wdc-dot ${i === 0 ? 'active' : ''}"
                      onclick="WordDetailCard.goTo('${cardId}', ${i})"></button>
            `).join('')}
          </div>
        ` : ''}

        ${options.showActions ? `
          <div class="wdc-actions">
            <button class="btn btn-sm btn-ghost" onclick="Router.navigate('/word-detail/${word.id}')">�� Detay</button>
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Kelime verisinden slide HTML'lerini oluştur
   * Her POS+Sense bir slide olur
   */
  buildSlides(word) {
    const slides = [];

    // Sections → POS Groups → Senses
    const sections = word.sections || [];

    for (const section of sections) {
      const posGroups = section.pos_groups || [];

      for (const pg of posGroups) {
        const senses = pg.senses || [];

        for (let si = 0; si < senses.length; si++) {
          const sense = senses[si];
          slides.push(this.buildSenseSlide(word, section, pg, sense, si + 1, senses.length));
        }
      }
    }

    // Eğer sentence_examples varsa ve hiç slide yoksa, onları da göster
    if (slides.length === 0 && word.sentence_examples && word.sentence_examples.length > 0) {
      slides.push(this.buildSentenceSlide(word));
    }

    // Cümle örnekleri slide'ı (varsa en sona ekle)
    if (slides.length > 0 && word.sentence_examples && word.sentence_examples.length > 0) {
      slides.push(this.buildSentenceSlide(word));
    }

    return slides;
  },

  buildSenseSlide(word, section, pg, sense, senseNum, totalSenses) {
    const definition = sense.definition || sense.def || '';
    const examples = sense.examples || [];
    const translations = sense.translations || [];
    const frequency = sense.frequency;
    const dialect = sense.dialect;
    const hasExclamation = sense.has_exclamation;
    const mentionText = sense.mention_text;
    const mentionSentence = sense.mention_sentence;

    // Examples — string veya object olabilir
    const exampleTexts = examples.map(e => {
      if (typeof e === 'string') return e;
      return e.example_text || e.text || e;
    }).filter(Boolean);

    // Translations — string veya object olabilir
    const translationTexts = translations.map(t => {
      if (typeof t === 'string') return t;
      return t.translation || t.text || t;
    }).filter(Boolean);

    const sectionWord = section.section_word || word.word;
    const showSectionWord = sectionWord.toLowerCase() !== (word.word || '').toLowerCase();

    return `
      <div class="wdc-sense-slide">
        <!-- POS + Section Bilgisi -->
        <div class="wdc-slide-top">
          ${pg.pos ? `<span class="wdc-pos">${pg.pos}</span>` : ''}
          ${showSectionWord ? `<span class="wdc-section-word">${sectionWord}</span>` : ''}
          ${section.is_base_form ? `<span class="wdc-base-badge">base form</span>` : ''}
          ${totalSenses > 1 ? `<span class="wdc-sense-num">Anlam ${senseNum}/${totalSenses}</span>` : ''}
        </div>

        <!-- Tanım -->
        <div class="wdc-definition">
          ${definition}
        </div>

        <!-- Rozetler -->
        <div class="wdc-badges">
          ${frequency ? `<span class="wdc-badge wdc-badge-freq">${frequency}</span>` : ''}
          ${dialect ? `<span class="wdc-badge wdc-badge-dialect">${dialect}</span>` : ''}
          ${hasExclamation ? `<span class="wdc-badge wdc-badge-warn">⚠️ informal</span>` : ''}
        </div>

        <!-- Çeviriler -->
        ${translationTexts.length > 0 ? `
          <div class="wdc-translations">
            ${translationTexts.map(t => `<span class="wdc-translation-chip">${t}</span>`).join('')}
          </div>
        ` : ''}

        <!-- Örnekler -->
        ${exampleTexts.length > 0 ? `
          <div class="wdc-examples">
            <div class="wdc-examples-label">Örnekler</div>
            ${exampleTexts.slice(0, 3).map(e => `
              <p class="wdc-example">"${e}"</p>
            `).join('')}
          </div>
        ` : ''}

        <!-- Eşanlamlı/Zıtanlamlı -->
        ${mentionText ? `<div class="wdc-mention"><span class="wdc-mention-label">📎</span> ${mentionText}</div>` : ''}
        ${mentionSentence ? `<div class="wdc-mention"><span class="wdc-mention-label">📎</span> ${mentionSentence}</div>` : ''}
      </div>
    `;
  },

  buildSentenceSlide(word) {
    const sentences = (word.sentence_examples || []).map(s => {
      if (typeof s === 'string') return s;
      return s.sentence_text || s.text || s;
    }).filter(Boolean);

    return `
      <div class="wdc-sense-slide wdc-sentence-slide">
        <div class="wdc-slide-top">
          <span class="wdc-pos">💬 Cümle İçinde Kullanım</span>
        </div>
        <div class="wdc-sentences">
          ${sentences.slice(0, 8).map(s => `
            <p class="wdc-sentence">"${s}"</p>
          `).join('')}
        </div>
      </div>
    `;
  },

  // ─── Slider Kontrolleri ───

  goTo(cardId, index) {
    const card = document.getElementById(cardId);
    if (!card) return;

    const total = parseInt(card.dataset.totalSlides);
    if (index < 0) index = 0;
    if (index >= total) index = total - 1;

    card.dataset.currentSlide = index;

    // Track kaydır
    const track = document.getElementById(`${cardId}-track`);
    if (track) {
      track.style.transform = `translateX(-${index * (100 / total)}%)`;
    }

    // Slide numarasını güncelle
    const numEl = document.getElementById(`${cardId}-slide-num`);
    if (numEl) numEl.textContent = index + 1;

    // Dot'ları güncelle
    const dotsContainer = document.getElementById(`${cardId}-dots`);
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.wdc-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });
    }

    // Nav butonlarını güncelle
    const prevBtn = document.getElementById(`${cardId}-prev`);
    const nextBtn = document.getElementById(`${cardId}-next`);
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === total - 1;
  },

  next(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const current = parseInt(card.dataset.currentSlide) || 0;
    this.goTo(cardId, current + 1);
  },

  prev(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const current = parseInt(card.dataset.currentSlide) || 0;
    this.goTo(cardId, current - 1);
  },

  // ─── Touch/Swipe Desteği ───
  initSwipe(cardId) {
    const slider = document.getElementById(`${cardId}-slider`);
    if (!slider) return;

    let startX = 0;
    let startY = 0;
    let isDragging = false;

    slider.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;

      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = startX - endX;
      const diffY = startY - endY;

      // Yatay swipe (dikey scroll'dan ayır)
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX > 0) {
          this.next(cardId);
        } else {
          this.prev(cardId);
        }
      }
    }, { passive: true });

    // Mouse swipe (desktop)
    slider.addEventListener('mousedown', (e) => {
      startX = e.clientX;
      isDragging = true;
      slider.style.cursor = 'grabbing';
    });

    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      slider.style.cursor = 'grab';

      const diffX = startX - e.clientX;
      if (Math.abs(diffX) > 50) {
        if (diffX > 0) this.next(cardId);
        else this.prev(cardId);
      }
    });
  },

  // ─── Keyboard desteği ───
  initKeyboard(cardId) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev(cardId);
      if (e.key === 'ArrowRight') this.next(cardId);
    });
  }
};