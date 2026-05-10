/**
 * Yoğunlaştırılmış SM-2 Algoritması — Server Service
 *
 * Parametreler user_settings tablosundan gelir.
 * Her review sonrası user_words tablosu güncellenir.
 */

function parseSteps(stepsStr) {
  if (!stepsStr) return [1, 10, 30, 1440, 4320];
  return stepsStr.split(',').map(s => parseInt(s.trim(), 10));
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function processReview(word, quality, settings) {
  const now = new Date();
  const isCorrect = quality >= 3;
  const steps = parseSteps(settings.learning_steps);
  const relearnSteps = parseSteps(settings.relearn_steps);

  // Snapshot
  const snapshot = {
    prev_ease: word.ease_factor,
    prev_interval: word.interval_days,
    prev_repetition: word.repetition,
    prev_step: word.current_step,
    prev_mastery: word.mastery_level
  };

  // ─── NEW veya LEARNING ───
  if (word.mastery_level === 'new' || word.mastery_level === 'learning') {
    if (isCorrect) {
      word.current_step++;
      if (word.current_step >= steps.length) {
        word.mastery_level = 'reviewing';
        word.current_step = 0;
        word.repetition = 1;
        word.interval_days = quality === 5
          ? settings.easy_interval
          : settings.graduating_interval;
        word.next_review_at = addDays(now, word.interval_days);
      } else {
        word.mastery_level = 'learning';
        word.next_review_at = addMinutes(now, steps[word.current_step]);
      }
    } else {
      word.current_step = 0;
      word.mastery_level = 'learning';
      word.next_review_at = addMinutes(now, steps[0]);
    }
  }

  // ─── RELEARN ───
  else if (word.mastery_level === 'relearn') {
    if (isCorrect) {
      word.current_step++;
      if (word.current_step >= relearnSteps.length) {
        word.mastery_level = 'reviewing';
        word.current_step = 0;
        word.repetition = 1;
        word.interval_days = Math.max(1, Math.round(word.interval_days * settings.lapse_penalty));
        word.next_review_at = addDays(now, word.interval_days);
      } else {
        word.next_review_at = addMinutes(now, relearnSteps[word.current_step]);
      }
    } else {
      word.current_step = 0;
      word.next_review_at = addMinutes(now, relearnSteps[0]);
    }
  }

  // ─── REVIEWING veya MASTERED ───
  else if (word.mastery_level === 'reviewing' || word.mastery_level === 'mastered') {
    if (isCorrect) {
      word.repetition++;
      word.streak++;
      word.best_streak = Math.max(word.best_streak, word.streak);

      word.ease_factor += 0.08 - (5 - quality) * (0.06 + (5 - quality) * 0.02);
      word.ease_factor = Math.max(settings.minimum_ease, word.ease_factor);

      if (word.repetition === 1) {
        word.interval_days = settings.graduating_interval;
      } else if (word.repetition === 2) {
        word.interval_days = settings.graduating_interval * 3;
      } else {
        word.interval_days = Math.round(
          word.interval_days
          * word.ease_factor
          * settings.interval_modifier
          * (quality === 5 ? settings.easy_bonus : 1.0)
        );
      }

      word.interval_days = Math.min(word.interval_days, settings.max_interval);

      if (word.interval_days > 120 && word.streak >= 8) {
        word.mastery_level = 'mastered';
      } else {
        word.mastery_level = 'reviewing';
      }

      word.next_review_at = addDays(now, word.interval_days);
    } else {
      word.lapse_count++;
      word.streak = 0;
      word.ease_factor -= settings.lapse_ease_penalty;
      word.ease_factor = Math.max(settings.minimum_ease, word.ease_factor);

      if (word.lapse_count >= settings.leech_threshold) {
        word.mastery_level = 'leech';
      } else {
        word.mastery_level = 'relearn';
      }

      word.current_step = 0;
      word.next_review_at = addMinutes(now, relearnSteps[0]);
    }
  }

  // ─── LEECH ───
  else if (word.mastery_level === 'leech') {
    if (isCorrect) {
      word.current_step++;
      if (word.current_step >= relearnSteps.length) {
        word.current_step = 0;
        word.interval_days = Math.max(1, Math.round(word.interval_days * settings.lapse_penalty));
        word.next_review_at = addDays(now, word.interval_days);
        word.streak++;
        if (word.streak >= 3) {
          word.mastery_level = 'reviewing';
          word.streak = 0;
        }
      } else {
        word.next_review_at = addMinutes(now, relearnSteps[word.current_step]);
      }
    } else {
      word.current_step = 0;
      word.streak = 0;
      word.next_review_at = addMinutes(now, relearnSteps[0]);
    }
  }

  // ─── Ortak Güncellemeler ───
  word.total_reviews++;
  if (isCorrect) word.correct_count++;
  else word.wrong_count++;
  word.last_reviewed_at = now;

  return {
    word,
    snapshot,
    new_mastery: word.mastery_level,
    new_ease: word.ease_factor,
    new_interval: word.interval_days,
    new_repetition: word.repetition,
    new_step: word.current_step
  };
}

function getDefaultSettings() {
  return {
    new_cards_per_day: 15,
    max_reviews_per_day: 150,
    learning_steps: '1,10,30,1440,4320',
    relearn_steps: '1,10,1440',
    graduating_interval: 1,
    easy_interval: 3,
    starting_ease: 2.30,
    minimum_ease: 1.50,
    easy_bonus: 1.15,
    interval_modifier: 0.85,
    max_interval: 180,
    lapse_penalty: 0.25,
    lapse_ease_penalty: 0.15,
    leech_threshold: 5,
    quiz_mode: 'mixed',
    show_phonetic: 1,
    show_examples: 1,
    theme: 'system'
  };
}

module.exports = { processReview, getDefaultSettings, parseSteps };