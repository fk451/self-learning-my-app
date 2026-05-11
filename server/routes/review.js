const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { processReview } = require('../services/sm2');
const { enrichWordsBatch } = require('../services/enrichWords');

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

    let words;
    let counts = {};

    if (session_type === 'leech_drill') {
      // Leech kelimeler - sorunlu kelimeler için özel çalışma
      const query = `
        SELECT uw.* FROM user_words uw
        WHERE uw.user_id = ? AND uw.mastery_level = 'leech'
        ORDER BY uw.lapse_count DESC 
        LIMIT ?
      `;
      const params = [userId, settings.max_reviews_per_day || 150];
      const [result] = await db.query(query, params);
      words = result;
      counts = { leech: words.length, total: words.length };

    } else if (session_type === 'new_words') {
      // Sadece yeni kelimeler
      const query = `
        SELECT uw.* FROM user_words uw
        WHERE uw.user_id = ? AND uw.mastery_level = 'new'
        ORDER BY uw.created_at ASC 
        LIMIT ?
      `;
      const params = [userId, settings.new_cards_per_day || 15];
      const [result] = await db.query(query, params);
      words = result;
      counts = { new: words.length, total: words.length };

    } else if (session_type === 'weak_words') {
      // Zayıf kelimeler (düşük ease, yüksek lapse)
      const query = `
        SELECT uw.* FROM user_words uw
        WHERE uw.user_id = ?
          AND uw.mastery_level IN ('reviewing', 'relearn')
          AND (uw.ease_factor < 2.0 OR uw.lapse_count >= 3)
        ORDER BY uw.ease_factor ASC 
        LIMIT ?
      `;
      const params = [userId, settings.max_reviews_per_day || 150];
      const [result] = await db.query(query, params);
      words = result;
      counts = { weak: words.length, total: words.length };

    } else {
      // Günlük review — yeni kelimeler ve tekrar edilecekler karışık
      
      // Yeni kelimeleri çek
      const [newWords] = await db.query(
        `SELECT uw.* FROM user_words uw
         WHERE uw.user_id = ? AND uw.mastery_level = 'new'
         ORDER BY uw.created_at ASC 
         LIMIT ?`,
        [userId, settings.new_cards_per_day || 15]
      );

      // Tekrar edilecek kelimeleri çek (new hariç tüm seviyeler)
      const newWordCount = newWords.length;
      const remainingLimit = Math.max(0, (settings.max_reviews_per_day || 150) - newWordCount);

      const [dueWords] = await db.query(
        `SELECT uw.* FROM user_words uw
         WHERE uw.user_id = ?
           AND uw.mastery_level != 'new'
           AND (uw.next_review_at IS NULL OR uw.next_review_at <= NOW())
         ORDER BY
           FIELD(uw.mastery_level, 'relearn', 'leech', 'learning', 'reviewing', 'mastered') ASC,
           uw.next_review_at ASC
         LIMIT ?`,
        [userId, remainingLimit]
      );

      words = [...dueWords, ...newWords];
      
      counts = {
        new: newWordCount,
        due: dueWords.length,
        total: words.length
      };
    }

    // Tüm kelimeleri toplu olarak zenginleştir (N+1 yerine 5 sabit sorgu)
    await enrichWordsBatch(words);

    res.json({
      words,
      counts,
      session_type
    });

  } catch (err) {
    console.error('Get due words error:', err);
    res.status(500).json({ 
      error: 'Çalışılacak kelimeler yüklenirken hata oluştu',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// ─── REVIEW GÖNDER ───
router.post('/submit', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const userId = req.user.id;
    const { word_id, quality, session_id } = req.body;

    // Validasyon
    if (quality === undefined || quality === null || quality < 0 || quality > 5) {
      return res.status(400).json({ error: 'Quality 0-5 arası bir değer olmalı.' });
    }

    if (!word_id) {
      return res.status(400).json({ error: 'word_id zorunludur.' });
    }

    // Kelimeyi al
    const [wordRows] = await conn.query(
      'SELECT * FROM user_words WHERE id = ? AND user_id = ?',
      [word_id, userId]
    );

    if (wordRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'Kelime bulunamadı.' });
    }

    // Kullanıcı ayarlarını al
    const [settingsRows] = await conn.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [userId]
    );

    const settings = settingsRows[0] || require('../services/sm2').getDefaultSettings();
    const word = wordRows[0];

    // SM-2 algoritması ile işle
    const result = processReview(word, parseInt(quality), settings);
    const { snapshot } = result;
    const updatedWord = result.word;

    // user_words güncelle
    await conn.query(
      `UPDATE user_words SET
        ease_factor = ?, 
        interval_days = ?, 
        repetition = ?,
        current_step = ?, 
        next_review_at = ?, 
        last_reviewed_at = NOW(),
        total_reviews = total_reviews + 1, 
        correct_count = correct_count + ?,
        wrong_count = wrong_count + ?,
        streak = ?, 
        best_streak = GREATEST(best_streak, ?),
        lapse_count = ?,
        mastery_level = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        updatedWord.ease_factor, 
        updatedWord.interval_days, 
        updatedWord.repetition,
        updatedWord.current_step, 
        updatedWord.next_review_at,
        quality >= 3 ? 1 : 0, // correct_count artışı
        quality < 3 ? 1 : 0,  // wrong_count artışı
        updatedWord.streak, 
        updatedWord.streak,
        updatedWord.lapse_count,
        updatedWord.mastery_level, 
        word_id
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
        word_id, 
        session_id || null, 
        quality, 
        isCorrect ? 1 : 0,
        snapshot.prev_ease, 
        snapshot.prev_interval, 
        snapshot.prev_repetition,
        snapshot.prev_step, 
        snapshot.prev_mastery,
        updatedWord.ease_factor, 
        updatedWord.interval_days, 
        updatedWord.repetition,
        updatedWord.current_step, 
        updatedWord.mastery_level,
        session_id ? 'scheduled' : 'manual'
      ]
    );

    // Günlük istatistik güncelle
    const graduated = snapshot.prev_mastery === 'learning' && updatedWord.mastery_level === 'reviewing';
    const lapsed = (updatedWord.mastery_level === 'relearn' || updatedWord.mastery_level === 'leech')
      && snapshot.prev_mastery !== 'relearn' && snapshot.prev_mastery !== 'leech';

    await conn.query(
      `INSERT INTO daily_stats 
        (user_id, stat_date, words_studied, correct_answers, wrong_answers, 
         new_graduated, lapsed_count)
       VALUES (?, CURDATE(), 1, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         words_studied = words_studied + 1,
         correct_answers = correct_answers + ?,
         wrong_answers = wrong_answers + ?,
         new_graduated = new_graduated + ?,
         lapsed_count = lapsed_count + ?`,
      [
        userId,
        isCorrect ? 1 : 0,
        isCorrect ? 0 : 1,
        graduated ? 1 : 0,
        lapsed ? 1 : 0,
        isCorrect ? 1 : 0,
        isCorrect ? 0 : 1,
        graduated ? 1 : 0,
        lapsed ? 1 : 0
      ]
    );

    // Session varsa güncelle
    if (session_id) {
      await conn.query(
        `UPDATE study_sessions 
         SET correct_cards = correct_cards + ?,
             wrong_cards = wrong_cards + ?
         WHERE id = ? AND user_id = ?`,
        [
          isCorrect ? 1 : 0,
          isCorrect ? 0 : 1,
          session_id,
          userId
        ]
      );
    }

    await conn.commit();

    res.json({
      success: true,
      message: 'Review başarıyla kaydedildi.',
      word: {
        id: word_id,
        mastery_level: updatedWord.mastery_level,
        ease_factor: updatedWord.ease_factor,
        interval_days: updatedWord.interval_days,
        next_review_at: updatedWord.next_review_at,
        streak: updatedWord.streak,
        total_reviews: updatedWord.total_reviews + 1 // Güncel değer
      }
    });

  } catch (err) {
    await conn.rollback();
    console.error('Submit review error:', err);
    res.status(500).json({ 
      error: 'Review kaydedilirken bir hata oluştu.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    conn.release();
  }
});

module.exports = router;