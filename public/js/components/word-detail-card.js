const WordDetailCard = {

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

        <div class="wdc-slider-wrapper">

          <div class="wdc-slider" id="${cardId}-slider">
            <div class="wdc-slides-track" id="${cardId}-track" style="width: ${totalSlides * 100}%;">
              ${slides.map((slide, i) => `
                <div class="wdc-slide" style="width: ${100 / totalSlides}%;">${slide}</div>
              `).join('')}
            </div>
          </div>

        </div>

       

        ${options.showActions ? `
          <div class="wdc-actions">
            <button class="btn btn-sm btn-ghost" onclick="Router.navigate('/word-detail/${word.id}')">📖 Detay</button>
          </div>
        ` : ''}
      </div>
    `;
  },
	/*
		${totalSlides > 1 ? `
            <button class="wdc-nav wdc-nav-prev" onclick="WordDetailCard.prev('${cardId}')" id="${cardId}-prev" disabled>‹</button>
          ` : ''}
	
		${totalSlides > 1 ? `
			<button class="wdc-nav wdc-nav-next" onclick="WordDetailCard.next('${cardId}')" id="${cardId}-next">›</button>
		  ` : ''}
	
	
		 ${totalSlides > 1 ? `
          <div class="wdc-dots" id="${cardId}-dots">
            ${slides.map((_, i) => `
              <button class="wdc-dot ${i === 0 ? 'active' : ''}" onclick="WordDetailCard.goTo('${cardId}', ${i})"></button>
            `).join('')}
          </div>
        ` : ''}
		
		
	*/


  buildSlides(word) {
    const slides = [];
    const sections = word.sections || [];

    for (const section of sections) {
      for (const pg of (section.pos_groups || [])) {
        for (let si = 0; si < (pg.senses || []).length; si++) {
          slides.push(this.buildSenseSlide(word, section, pg, pg.senses[si], si + 1, pg.senses.length));
        }
      }
    }

    if (slides.length === 0 && word.sentence_examples && word.sentence_examples.length > 0) {
      slides.push(this.buildSentenceSlide(word));
    }

    if (slides.length > 0 && word.sentence_examples && word.sentence_examples.length > 0) {
      slides.push(this.buildSentenceSlide(word));
    }

    return slides;
  },

  buildSenseSlide(word, section, pg, sense, senseNum, totalSenses) {
    const definition = sense.definition || sense.def || '';
    const examples = (sense.examples || []).map(e => typeof e === 'string' ? e : e.example_text || e.text || e).filter(Boolean);
    const translations = (sense.translations || []).map(t => typeof t === 'string' ? t : t.translation || t.text || t).filter(Boolean);
    const sectionWord = section.section_word || word.word;
    const showSectionWord = sectionWord.toLowerCase() !== (word.word || '').toLowerCase();

    return `
      <div class="wdc-sense-slide">
        <div class="wdc-slide-top">
          ${pg.pos ? `<span class="wdc-pos">${pg.pos}</span>` : ''}
          ${showSectionWord ? `<span class="wdc-section-word">${sectionWord}</span>` : ''}
          ${section.is_base_form ? `<span class="wdc-base-badge">base form</span>` : ''}
          ${totalSenses > 1 ? `<span class="wdc-sense-num">Anlam ${senseNum}/${totalSenses}</span>` : ''}
        </div>
        <div class="wdc-definition">
          ${sense.mention_text ? `(${sense.mention_text}) ` : ''}${definition}
        </div>
        <div class="wdc-badges">
          ${sense.frequency ? `<span class="wdc-badge wdc-badge-freq">${sense.frequency}</span>` : ''}
          ${sense.dialect ? `<span class="wdc-badge wdc-badge-dialect">${sense.dialect}</span>` : ''}
          ${sense.has_exclamation ? `<span class="wdc-badge wdc-badge-warn">⚠️ informal</span>` : ''}
        </div>
        ${translations.length > 0 ? `
          <div class="wdc-translations">
            ${translations.map(t => `<span class="wdc-translation-chip">${t}</span>`).join('')}
          </div>
        ` : ''}
        ${examples.length > 0 ? `
          <div class="wdc-examples">
            <div class="wdc-examples-label">Örnekler</div>
            ${examples.slice(0, 3).map(e => `<p class="wdc-example">"${e}"</p>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  buildSentenceSlide(word) {
    const sentences = (word.sentence_examples || []).map(s => typeof s === 'string' ? s : s.sentence_text || s.text || s).filter(Boolean);
    return `
      <div class="wdc-sense-slide wdc-sentence-slide">
        <div class="wdc-slide-top">
          <span class="wdc-pos">💬 Cümle İçinde Kullanım</span>
        </div>
        <div class="wdc-sentences">
          ${sentences.slice(0, 8).map(s => `<p class="wdc-sentence">"${s}"</p>`).join('')}
        </div>
      </div>
    `;
  },

  goTo(cardId, index) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const total = parseInt(card.dataset.totalSlides);
    if (index < 0) index = 0;
    if (index >= total) index = total - 1;
    card.dataset.currentSlide = index;

    const track = document.getElementById(`${cardId}-track`);
    if (track) track.style.transform = `translateX(-${index * (100 / total)}%)`;

    const numEl = document.getElementById(`${cardId}-slide-num`);
    if (numEl) numEl.textContent = index + 1;

    const dotsContainer = document.getElementById(`${cardId}-dots`);
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.wdc-dot').forEach((dot, i) => dot.classList.toggle('active', i === index));
    }

    const prevBtn = document.getElementById(`${cardId}-prev`);
    const nextBtn = document.getElementById(`${cardId}-next`);
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === total - 1;
  },

  next(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    this.goTo(cardId, (parseInt(card.dataset.currentSlide) || 0) + 1);
  },

  prev(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    this.goTo(cardId, (parseInt(card.dataset.currentSlide) || 0) - 1);
  },

  initSwipe(cardId) {
    const slider = document.getElementById(`${cardId}-slider`);
    if (!slider) return;
    if (slider.dataset.swipeInit === 'true') return;
    slider.dataset.swipeInit = 'true';

    let startX = 0, startY = 0;

    slider.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
      const diffX = startX - e.changedTouches[0].clientX;
      const diffY = startY - e.changedTouches[0].clientY;
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
        if (diffX > 0) this.next(cardId);
        else this.prev(cardId);
      }
    }, { passive: true });

    let mouseX = 0, mouseDown = false;
    slider.addEventListener('mousedown', (e) => { mouseX = e.clientX; mouseDown = true; slider.style.cursor = 'grabbing'; });
    slider.addEventListener('mouseup', (e) => {
      if (!mouseDown) return;
      mouseDown = false;
      slider.style.cursor = 'grab';
      const diffX = mouseX - e.clientX;
      if (Math.abs(diffX) > 40) { if (diffX > 0) this.next(cardId); else this.prev(cardId); }
    });
    slider.addEventListener('mouseleave', () => { mouseDown = false; slider.style.cursor = 'grab'; });
  },

  initKeyboard(cardId) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.prev(cardId);
      if (e.key === 'ArrowRight') this.next(cardId);
    });
  }
};