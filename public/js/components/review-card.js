const ReviewCard = {
  isFlipped: false,

  render(word, index, total) {
    this.isFlipped = false;
    const cardId = `review-wdc-${word.id || index}`;

    const masteryLabels = {
      new: '🆕 Yeni', learning: '📗 Öğreniliyor', reviewing: '🔄 Tekrarda',
      mastered: '⭐ Uzmanlaşıldı', leech: '⚠️ Sorunlu', relearn: '🔁 Yeniden'
    };

    return `
      <div class="review-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${((index + 1) / total) * 100}%"></div>
        </div>
        <span class="progress-text">${index + 1} / ${total}</span>
      </div>

      <div class="review-card-container" id="review-card-flip">
        <div class="review-card">
          <div class="review-card-front" onclick="ReviewCard.flip()">
            <span class="review-mastery">${masteryLabels[word.mastery_level] || ''}</span>
            <h2 class="review-word">${word.word}</h2>
            ${word.phonetic ? `<p class="review-phonetic">${word.phonetic}</p>` : ''}
            <p class="flip-hint">Anlamı görmek için dokun 👆</p>
          </div>

          <div class="review-card-back" onclick="event.stopPropagation()">
            <div class="review-back-inner" id="review-back-inner">
              ${WordDetailCard.render(word, { cardId, showActions: false, compact: true })}
            </div>
          </div>
        </div>
      </div>

      <div class="review-actions-simple" id="review-actions">
        <button class="review-btn review-btn-fail" onclick="ReviewPage.submitAnswer(false)">
          <span class="review-btn-icon">❌</span>
          <span class="review-btn-text">Hatırlamıyorum</span>
        </button>
        <button class="review-btn review-btn-success" onclick="ReviewPage.submitAnswer(true)">
          <span class="review-btn-icon">✅</span>
          <span class="review-btn-text">Hatırlıyorum</span>
        </button>
      </div>
    `;
  },

  flip() {
    if (this.isFlipped) return;
    this.isFlipped = true;

    const card = document.querySelector('.review-card');
    const actions = document.getElementById('review-actions');

    if (card) card.classList.add('flipped');
    if (actions) actions.classList.add('visible');

    setTimeout(() => {
      const wdcEl = document.querySelector('.review-card-back .wdc');
      if (wdcEl) WordDetailCard.initSwipe(wdcEl.id);
    }, 450);
  }
};