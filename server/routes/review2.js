const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { processReview } = require('../services/sm2');

// ─── BUGÜN ÇALIŞILACAK KELİMELER ───
router.get('/due', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { session_type = 'daily_review' } = req.query;

    // Kullanıcı ayarları
    const [settingsRows] = await db.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [userId]
    );
    const settings = settingsRows[0] || {};

    let query, params;

    if (session_type === 'leech_drill') {
      // Leech kelimeler
      query = `SELECT uw.* FROM user_words uw
               WHERE uw.user_id = ? AND uw.mastery_level = 'leech'
               ORDER BY uw.lapse_count DESC LIMIT ?`;
      params = [userId, settings.max_reviews_per_day || 150];

    } else if (session_type === 'new_words') {
      // Yeni kelimeler
      query = `SELECT uw.* FROM user_words uw
               WHERE uw.user_id = ? AND uw.mastery_level = 'new'
               ORDER BY uw.created_at ASC LIMIT ?`;
      params = [userId, settings.new_cards_per_day || 15];

    } else if (session_type === 'weak_words') {
      // Zayıf kelimeler (düşük ease, yüksek lapse)
      query = `SELECT uw.* FROM user_words uw
               WHERE uw.user_id = ?
                 AND uw.mastery_level IN ('reviewing', 'relearn')
                 AND (uw.ease_factor < 2.0 OR uw.lapse_count >= 3)
               ORDER BY uw.ease_factor ASC LIMIT ?`;
      params = [userId, settings.max_reviews_per_day || 150];

    } else {
      // Günlük review — öncelik sıralı
      // Yeni kelimeler için ayrı limit
      const [newWords] = await db.query(
        `SELECT uw.* FROM user_words uw
         WHERE uw.user_id = ? AND uw.mastery_level = 'new'
         ORDER BY uw.created_at ASC LIMIT ?`,
        [userId, settings.new_cards_per_day || 15]
      );

      // Review / relearn / leech / learning
      const [dueWords] = await db.query(
        `SELECT uw.* FROM user_words uw
         WHERE uw.user_id = ?
           AND uw.mastery_level != 'new'
           AND (uw.next_review_at IS NULL OR uw.next_review_at <= NOW())
         ORDER BY
           FIELD(uw.mastery_level, 'relearn', 'leech', 'learning', 'reviewing', 'mastered') ASC,
           uw.next_review_at ASC
         LIMIT ?`,
        [userId, (settings.max_reviews_per_day || 150) - newWords.length]
      );

      const allWords = [...dueWords, ...newWords];

      // Her kelime için temel anlam bilgisi
      for (const w of allWords) {
        await enrichWordForReview(w);
      }

      return res.json({
        words: allWords,
        counts: {
          new: newWords.length,
          due: dueWords.length,
          total: allWords.length
        }
      });
    }

    const [words] = await db.query(query, params);

    for (const w of words) {
      await enrichWordForReview(w);
    }

    res.json({ words, counts: { total: words.length } });

  } catch (err) {
    console.error('Get due words error:', err);
    res.status(500).json({ error: 'Çalışılacak kelimeler yüklenirken hata oluştu' });
  }
});

// Kelimeye review için gerekli bilgileri ekle
async function enrichWordForReview(word) {
  // İlk section'ın ilk POS grubunun ilk sense'ini al
  const [sections] = await db.query(
    `SELECT ws.id, ws.section_word FROM word_sections ws
     WHERE ws.user_word_id = ? ORDER BY ws.display_order LIMIT 1`,
    [word.id]
  );

  if (sections.length > 0) {
    const [posGroups] = await db.query(
      `SELECT wpg.id, wpg.pos FROM word_pos_groups wpg
       WHERE wpg.section_id = ? ORDER BY wpg.display_order`,
      [sections[0].id]
    );

    word.pos_groups = [];
    for (const pg of posGroups) {
      const [senses] = await db.query(
        `SELECT ps.id, ps.definition, ps.frequency FROM pos_senses ps
         WHERE ps.pos_group_id = ? ORDER BY ps.display_order`,
        [pg.id]
      );

      for (const sense of senses) {
        const [translations] = await db.query(
          `SELECT st.translation FROM sense_translations st
           WHERE st.sense_id = ? ORDER BY st.display_order`,
          [sense.id]
        );
        const [examples] = await db.query(
          `SELECT se.example_text FROM sense_examples se
           WHERE se.sense_id = ? ORDER BY se.display_order LIMIT 2`,
          [sense.id]
        );
        sense.translations = translations.map(t => t.translation);
        sense.examples = examples.map(e => e.example_text);
      }

      word.pos_groups.push({ pos: pg.pos, senses });
    }
  }
}

// ─── REVIEW GÖNDER ───
router.post('/submit', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const userId = req.user.id;
    const { word_id, quality, session_id } = req.body;

    if (quality === undefined || quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'Quality 0-5 arası olmalı' });
    }

    // Kelimeyi al
    const [wordRows] = await conn.query(
      'SELECT * FROM user_words WHERE id = ? AND user_id = ?',
      [word_id, userId]
    );

    if (wordRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Kelime bulunamadı' });
    }

    // Ayarları al
    const [settingsRows] = await conn.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [userId]
    );

    const settings = settingsRows[0] || require('../services/sm2').getDefaultSettings();
    const word = wordRows[0];

    // SM-2 işle
    const result = processReview(word, parseInt(quality), settings);
    const { snapshot } = result;
    const updatedWord = result.word;

    // user_words güncelle
    await conn.query(
      `UPDATE user_words SET
        ease_factor = ?, interval_days = ?, repetition = ?,
        current_step = ?, next_review_at = ?, last_reviewed_at = ?,
        total_reviews = ?, correct_count = ?, wrong_count = ?,
        streak = ?, best_streak = ?, lapse_count = ?,
        mastery_level = ?
       WHERE id = ?`,
      [
        updatedWord.ease_factor, updatedWord.interval_days, updatedWord.repetition,
        updatedWord.current_step, updatedWord.next_review_at, updatedWord.last_reviewed_at,
        updatedWord.total_reviews, updatedWord.correct_count, updatedWord.wrong_count,
        updatedWord.streak, updatedWord.best_streak, updatedWord.lapse_count,
        updatedWord.mastery_level, word_id
      ]
    );

    // review_history kaydet
    const isCorrect = quality >= 3;
    await conn.query(
      `INSERT INTO review_history
        (user_word_id, session_id, quality, is_correct,
         prev_ease, prev_interval, prev_repetition, prev_step, prev_mastery,
         new_ease, new_interval, new_repetition, new_step, new_mastery,
         review_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        word_id, session_id || null, quality, isCorrect ? 1 : 0,
        snapshot.prev_ease, snapshot.prev_interval, snapshot.prev_repetition,
        snapshot.prev_step, snapshot.prev_mastery,
        updatedWord.ease_factor, updatedWord.interval_days, updatedWord.repetition,
        updatedWord.current_step, updatedWord.mastery_level,
        session_id ? 'scheduled' : 'manual'
      ]
    );

    // Günlük istatistik güncelle
    const correctCol = isCorrect ? 'correct_answers = correct_answers + 1' : 'wrong_answers = wrong_answers + 1';
    const graduatedCol = (snapshot.prev_mastery === 'learning' && updatedWord.mastery_level === 'reviewing')
      ? ', new_graduated = new_graduated + 1' : '';
    const lapsedCol = (updatedWord.mastery_level === 'relearn' || updatedWord.mastery_level === 'leech')
      && snapshot.prev_mastery !== 'relearn' && snapshot.prev_mastery !== 'leech'
      ? ', lapsed_count = lapsed_count + 1' : '';

    await conn.query(
      `INSERT INTO daily_stats (user_id, stat_date, words_studied, ${isCorrect ? 'correct_answers' : 'wrong_answers'})
       VALUES (?, CURDATE(), 1, 1)
       ON DUPLICATE KEY UPDATE
         words_studied = words_studied + 1,
         ${correctCol}
         ${graduatedCol}
         ${lapsedCol}`,
      [userId]
    );

    await conn.commit();

    res.json({
      message: 'Review kaydedildi',
      word: {
        id: word_id,
        mastery_level: updatedWord.mastery_level,
        ease_factor: updatedWord.ease_factor,
        interval_days: updatedWord.interval_days,
        next_review_at: updatedWord.next_review_at,
        streak: updatedWord.streak
      }
    });

  } catch (err) {
    await conn.rollback();
    console.error('Submit review error:', err);
    res.status(500).json({ error: 'Review kaydedilirken hata oluştu' });
  } finally {
    conn.release();
  }
});

module.exports = router;