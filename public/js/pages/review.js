const ReviewPage = {
  words: [],
  currentIndex: 0,
  sessionId: null,
  sessionType: 'daily_review',
  results: { correct: 0, wrong: 0, skipped: 0 },
  startTime: null,
  isSubmitting: false,

  async render(container) {
    // Loading göster
    container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

    // Session tipini belirle
    const hash = window.location.hash;
    if (hash.includes('type=leech_drill')) this.sessionType = 'leech_drill';
    else this.sessionType = 'daily_review';

    // State'i sıfırla
    this.currentIndex = 0;
    this.results = { correct: 0, wrong: 0, skipped: 0 };
    this.startTime = Date.now();
    this.isSubmitting = false;

    try {
      // TEK İSTEK: Backend'den tüm kelimeleri ve detaylarını al
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

      // Backend'den gelen zenginleştirilmiş veriyi doğrudan kullan
      // Artık N+1 HTTP isteğine gerek yok!
      this.words = data.words.map(word => this.normalizeWordData(word));

      // Session başlat (istatistik için)
      try {
        const session = await API.startSession({
          session_type: this.sessionType,
          total_cards: this.words.length
        });
        if (session && session.sessionId) {
          this.sessionId = session.sessionId;
        }
      } catch (err) {
        console.warn('Session başlatılamadı, inceleme devam edecek:', err);
      }

      // İlk kartı göster
      this.showCard(container);

    } catch (err) {
      console.error('Review başlatma hatası:', err);
      container.innerHTML = `
        <div class="page review-page">
          <div class="error-page">
            <div class="error-icon">⚠️</div>
            <h2>Hata</h2>
            <p>${err.message || 'Kelimeler yüklenirken bir hata oluştu.'}</p>
            <button class="btn btn-primary" onclick="ReviewPage.render(document.getElementById('main-content'))">
              🔄 Tekrar Dene
            </button>
            <a href="#/dashboard" class="btn btn-secondary">🏠 Ana Sayfa</a>
          </div>
        </div>
      `;
    }
  },

  /**
   * Backend'den gelen kelime verisini UI için normalize et
   */
  normalizeWordData(word) {
    // Backend artık pos_groups, sections gibi alanları zaten döndüğü için
    // sadece UI'ın beklediği formatta olduğundan emin oluyoruz
    return {
      id: word.id,
      user_id: word.user_id,
      word: word.word,
      phonetic: word.phonetic || '',
      
      // SM-2 alanları
      mastery_level: word.mastery_level || 'new',
      ease_factor: word.ease_factor,
      interval_days: word.interval_days,
      repetition: word.repetition,
      
      // Detaylar (backend enrichment ile geliyor)
      sections: word.sections || [],
      pos_groups: word.pos_groups || [],
      primary_translation: word.primary_translation || '',
      primary_definition: word.primary_definition || '',
      sentence_examples: word.sentence_examples || '',
      
      // İstatistikler
      total_reviews: word.total_reviews || 0,
      correct_count: word.correct_count || 0,
      wrong_count: word.wrong_count || 0,
      streak: word.streak || 0,
      best_streak: word.best_streak || 0,
      lapse_count: word.lapse_count || 0,
      
      // Kaynak
      source_url: word.source_url || '',
      created_at: word.created_at
    };
  },

  showCard(container) {
    if (!container) container = document.getElementById('main-content');
    this.isSubmitting = false;

    // Tüm kartlar bitti mi kontrol et
    if (this.currentIndex >= this.words.length) {
      this.showResults(container);
      return;
    }

    const word = this.words[this.currentIndex];

    container.innerHTML = `
      <div class="page review-page">
        <div class="review-header">
          <button class="btn btn-ghost btn-sm" onclick="ReviewPage.confirmExit()">
            ✕ Çık
          </button>
          <span class="review-count">
            ${this.sessionType === 'leech_drill' ? '⚠️ Sorunlu' : '📖 Çalışma'}
            • ${this.currentIndex + 1}/${this.words.length}
          </span>
          <button class="btn btn-ghost btn-sm" onclick="ReviewPage.skipWord()">
            Atla →
          </button>
        </div>

        ${ReviewCard.render(word, this.currentIndex, this.words.length)}
      </div>
    `;

    // Kart animasyonu için
    const cardContainer = document.querySelector('.review-card-container');
    if (cardContainer) {
      cardContainer.classList.add('card-enter');
    }
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
      b.style.cursor = 'not-allowed';
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

    // İstatistikleri güncelle
    if (remembered) {
      this.results.correct++;
    } else {
      this.results.wrong++;
    }

    // API'ye review gönder (asenkron, beklemeden devam edebiliriz)
    try {
      await API.submitReview({
        word_id: word.id,
        quality: quality,
        session_id: this.sessionId
      });
    } catch (err) {
      console.error('Review gönderme hatası:', err);
      // Hata olsa bile kullanıcı deneyimini etkileme
    }

    // Kart üstünde kısa feedback göster
    this.showFeedback(remembered);

    // 1 saniye bekle - kullanıcı feedback'i görsün
    await new Promise(r => setTimeout(r, 1000));

    // Kart çıkış animasyonu
    const cardContainer = document.querySelector('.review-card-container');
    if (cardContainer) {
      cardContainer.classList.add(remembered ? 'card-exit-right' : 'card-exit-left');
    }

    const actionsEl = document.getElementById('review-actions');
    if (actionsEl) actionsEl.classList.add('actions-exit');

    // Animasyon bitsin (350ms)
    await new Promise(r => setTimeout(r, 350));

    // Sonraki kart
    this.currentIndex++;
    this.showCard();
  },

  /**
   * Kullanıcıya kısa süreli feedback göster
   */
  showFeedback(remembered) {
    // Varsa eski feedback'i kaldır
    const oldFeedback = document.querySelector('.review-feedback');
    if (oldFeedback) oldFeedback.remove();

    const feedbackEl = document.createElement('div');
    feedbackEl.className = `review-feedback ${remembered ? 'feedback-success' : 'feedback-fail'}`;
    feedbackEl.innerHTML = remembered
      ? '<span>✅ Hatırlandı!</span>'
      : '<span>❌ Tekrar gözden geçir</span>';

    const cardContainer = document.querySelector('.review-card-container');
    if (cardContainer) {
      cardContainer.parentElement.insertBefore(feedbackEl, cardContainer.nextSibling);
    }
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
      `${this.currentIndex} / ${this.words.length} kelime tamamlandı.\nÇıkmak istediğinize emin misiniz?`
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
        skipped_cards: this.results.skipped,
        duration_seconds: duration
      });
    } catch (err) {
      console.warn('Session tamamlama hatası:', err);
    }
  },

  async showResults(container) {
    if (!container) container = document.getElementById('main-content');

    // Session'ı tamamla
    await this.endSession();

    const total = this.results.correct + this.results.wrong;
    const accuracy = total > 0 ? Math.round(this.results.correct * 100 / total) : 0;
    const duration = Math.round((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    let emoji = '🎉';
    let message = 'Harika iş çıkardın!';
    if (accuracy < 50) { 
      emoji = '💪'; 
      message = 'Pratik yapmaya devam et!'; 
    } else if (accuracy < 80) { 
      emoji = '👍'; 
      message = 'İyi gidiyorsun!'; 
    } else if (accuracy === 100) { 
      emoji = '🏆'; 
      message = 'Mükemmel! Tam isabet!'; 
    }

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
              <span class="result-label">Tekrar Edilecek</span>
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

          ${accuracy < 50 ? `
            <div class="encouragement-note">
              💡 İpucu: Zorlandığın kelimeler için örnek cümleleri inceleyebilirsin.
            </div>
          ` : ''}

          <div class="results-actions">
            <a href="#/dashboard" class="btn btn-primary btn-lg">🏠 Ana Sayfaya Dön</a>
            <button class="btn btn-secondary btn-lg" onclick="ReviewPage.render(document.getElementById('main-content'))">
              🔄 Tekrar Çalış
            </button>
          </div>
        </div>
      </div>
    `;

    // Sonuç ekranı animasyonu
    const resultsEl = document.querySelector('.review-results');
    if (resultsEl) {
      resultsEl.classList.add('results-enter');
    }
  }
};

// Router'a kaydet
Router.register('/review', (container) => ReviewPage.render(container));