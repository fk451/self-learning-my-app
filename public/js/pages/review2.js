const ReviewPage = {
  words: [],
  currentIndex: 0,
  sessionId: null,
  sessionType: 'daily_review',
  results: { correct: 0, wrong: 0, skipped: 0 },
  startTime: null,
  isSubmitting: false,

  async render(container) {
    container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    const hash = window.location.hash;
    if (hash.includes('type=leech_drill')) this.sessionType = 'leech_drill';
    else this.sessionType = 'daily_review';

    this.currentIndex = 0;
    this.results = { correct: 0, wrong: 0, skipped: 0 };
    this.startTime = Date.now();
    this.isSubmitting = false;

    try {
      const data = await API.getDueWords(this.sessionType);
      if (!data || !data.words || data.words.length === 0) {
        container.innerHTML = `
          <div class="page review-page">
            <div class="empty-state">
              <div class="empty-icon">🎉</div>
              <h2>Tebrikler!</h2>
              <p>${this.sessionType === 'leech_drill'
                ? 'Sorunlu kelime bulunmuyor.'
                : 'Bugün çalışılacak kelime kalmadı.'
              }</p>
              <div class="empty-actions">
                <a href="#/dashboard" class="btn btn-primary">🏠 Ana Sayfa</a>
                <a href="#/add-word" class="btn btn-secondary">➕ Kelime Ekle</a>
              </div>
            </div>
          </div>
        `;
        return;
      }

      this.words = data.words;

      for (let i = 0; i < this.words.length; i++) {
        try {
          const detail = await API.getWord(this.words[i].id);
          if (detail) this.words[i] = { ...this.words[i], ...detail };
        } catch { /* mevcut veri ile devam */ }
      }

      try {
        const session = await API.startSession({
          session_type: this.sessionType,
          total_cards: this.words.length
        });
        if (session) this.sessionId = session.sessionId;
      } catch { /* Sessiz */ }

      this.showCard(container);

    } catch (err) {
      container.innerHTML = `
        <div class="page review-page">
          <div class="error-page">
            <div class="error-icon">⚠️</div>
            <h2>Hata</h2>
            <p>${err.message}</p>
            <a href="#/dashboard" class="btn btn-primary">🏠 Ana Sayfa</a>
          </div>
        </div>
      `;
    }
  },

  showCard(container) {
    if (!container) container = document.getElementById('main-content');
    this.isSubmitting = false;

    if (this.currentIndex >= this.words.length) {
      this.showResults(container);
      return;
    }

    const word = this.words[this.currentIndex];

    container.innerHTML = `
      <div class="page review-page">
        <div class="review-header">
          <button class="btn btn-ghost btn-sm" onclick="ReviewPage.confirmExit()">✕ Çık</button>
          <span class="review-count">
            ${this.sessionType === 'leech_drill' ? '⚠️ Sorunlu' : '📖 Çalışma'}
          </span>
          <button class="btn btn-ghost btn-sm" onclick="ReviewPage.skipWord()">Atla →</button>
        </div>

        ${ReviewCard.render(word, this.currentIndex, this.words.length)}
      </div>
    `;
  },

  async submitAnswer(remembered) {
    // Çift tıklama engeli
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const word = this.words[this.currentIndex];
    if (!word) return;

    // Butonları devre dışı bırak
    const btns = document.querySelectorAll('.review-btn');
    btns.forEach(b => {
      b.disabled = true;
      b.style.opacity = '0.5';
    });

    // Seçilen butona görsel geri bildirim
    const selectedBtn = remembered
      ? document.querySelector('.review-btn-success')
      : document.querySelector('.review-btn-fail');
    if (selectedBtn) {
      selectedBtn.style.opacity = '1';
      selectedBtn.style.transform = 'scale(1.05)';
      selectedBtn.style.borderWidth = '3px';
    }

    const quality = remembered ? 4 : 1;

    if (remembered) {
      this.results.correct++;
    } else {
      this.results.wrong++;
    }

    // API'ye gönder
    try {
      await API.submitReview({
        word_id: word.id,
        quality: quality,
        session_id: this.sessionId
      });
    } catch (err) {
      console.error('Review submit hatası:', err);
    }

    // Sonuç göster — kart üstünde kısa feedback
    const feedbackEl = document.createElement('div');
    feedbackEl.className = `review-feedback ${remembered ? 'feedback-success' : 'feedback-fail'}`;
    feedbackEl.innerHTML = remembered
      ? '<span>✅ Hatırlandı!</span>'
      : '<span>❌ Tekrar gelecek</span>';

    const cardContainer = document.querySelector('.review-card-container');
    if (cardContainer) {
      cardContainer.parentElement.insertBefore(feedbackEl, cardContainer.nextSibling);
    }

    // 1 saniye bekle — kullanıcı feedback'i görsün
    await new Promise(r => setTimeout(r, 1000));

    // Kart çıkış animasyonu
    if (cardContainer) {
      cardContainer.classList.add(remembered ? 'card-exit-right' : 'card-exit-left');
    }

    const actionsEl = document.getElementById('review-actions');
    if (actionsEl) actionsEl.classList.add('actions-exit');

    // Animasyon bitsin
    await new Promise(r => setTimeout(r, 350));

    // Sonraki kart
    this.currentIndex++;
    this.showCard();
  },

  skipWord() {
    this.results.skipped++;

    const cardContainer = document.querySelector('.review-card-container');
    if (cardContainer) {
      cardContainer.classList.add('card-exit-up');
    }

    setTimeout(() => {
      this.currentIndex++;
      this.showCard();
    }, 300);
  },

  async confirmExit() {
    const confirmed = await Modal.confirm(
      'Çalışmayı Bitir',
      `${this.currentIndex} / ${this.words.length} kelime tamamlandı. Çıkmak istiyor musunuz?`
    );
    if (confirmed) {
      await this.endSession();
      Router.navigate('/dashboard');
    }
  },

  async endSession() {
    if (!this.sessionId) return;
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    try {
      await API.completeSession(this.sessionId, {
        cards_studied: this.results.correct + this.results.wrong,
        correct_answers: this.results.correct,
        wrong_answers: this.results.wrong,
        duration_seconds: duration
      });
    } catch { /* Sessiz */ }
  },

  async showResults(container) {
    if (!container) container = document.getElementById('main-content');

    await this.endSession();

    const total = this.results.correct + this.results.wrong;
    const accuracy = total > 0 ? Math.round(this.results.correct * 100 / total) : 0;
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    let emoji = '🎉';
    let message = 'Harika!';
    if (accuracy < 50) { emoji = '💪'; message = 'Pratik yapmaya devam!'; }
    else if (accuracy < 80) { emoji = '👍'; message = 'İyi gidiyorsun!'; }
    else if (accuracy === 100) { emoji = '🏆'; message = 'Mükemmel!'; }

    container.innerHTML = `
      <div class="page review-page">
        <div class="review-results">
          <div class="results-icon">${emoji}</div>
          <h2>${message}</h2>

          <div class="results-grid">
            <div class="result-item result-correct">
              <span class="result-value">${this.results.correct}</span>
              <span class="result-label">Hatırlanan</span>
            </div>
            <div class="result-item result-wrong">
              <span class="result-value">${this.results.wrong}</span>
              <span class="result-label">Hatırlanmayan</span>
            </div>
            <div class="result-item result-accuracy">
              <span class="result-value">${accuracy}%</span>
              <span class="result-label">Doğruluk</span>
            </div>
            <div class="result-item result-time">
              <span class="result-value">${minutes}:${seconds.toString().padStart(2, '0')}</span>
              <span class="result-label">Süre</span>
            </div>
          </div>

          ${this.results.skipped > 0 ? `
            <p class="skipped-note">${this.results.skipped} kelime atlandı</p>
          ` : ''}

          <div class="results-actions">
            <a href="#/dashboard" class="btn btn-primary btn-lg">🏠 Ana Sayfa</a>
            <button class="btn btn-secondary btn-lg" onclick="ReviewPage.render(document.getElementById('main-content'))">
              🔄 Tekrar Çalış
            </button>
          </div>
        </div>
      </div>
    `;
  }
};

Router.register('/review', (container) => ReviewPage.render(container));