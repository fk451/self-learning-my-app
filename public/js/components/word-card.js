/**
 * Kelime Kartı Component
 */
const WordCard = {
  render(word) {
    const accuracy = word.total_reviews > 0
      ? Math.round(word.correct_count * 100 / word.total_reviews)
      : 0;

    const masteryColors = {
      new: 'mastery-new',
      learning: 'mastery-learning',
      reviewing: 'mastery-reviewing',
      mastered: 'mastery-mastered',
      leech: 'mastery-leech',
      relearn: 'mastery-relearn'
    };

    const masteryLabels = {
      new: 'Yeni',
      learning: 'Öğreniliyor',
      reviewing: 'Tekrarda',
      mastered: 'Uzmanlaşıldı',
      leech: 'Sorunlu',
      relearn: 'Yeniden Öğrenme'
    };

    return `
      <div class="word-card" data-word-id="${word.id}" onclick="Router.navigate('/word-detail/${word.id}')">
        <div class="word-card-header">
          <h3 class="word-title">${word.word}</h3>
          ${word.phonetic ? `<span class="word-phonetic">${word.phonetic}</span>` : ''}
        </div>
        <div class="word-card-body">
          <span class="mastery-badge ${masteryColors[word.mastery_level]}">
            ${masteryLabels[word.mastery_level]}
          </span>
          <div class="word-meta">
            <span title="Tekrar sayısı">🔄 ${word.total_reviews}</span>
            <span title="Doğruluk">🎯 ${accuracy}%</span>
            <span title="Seri">🔥 ${word.streak}</span>
          </div>
        </div>
        <div class="word-card-footer">
          ${word.tags ? word.tags.map(t =>
            `<span class="tag-chip" style="--tag-color:${t.color}">${t.name}</span>`
          ).join('') : ''}
          <span class="word-date">${formatRelativeDate(word.created_at)}</span>
        </div>
      </div>
    `;
  }
};

function formatRelativeDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return `${diffDays} gün önce`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta önce`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ay önce`;
  return `${Math.floor(diffDays / 365)} yıl önce`;
}

function formatDuration(seconds) {
  if (!seconds) return '0dk';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}sa ${m}dk`;
  return `${m}dk`;
}