const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ─── DASHBOARD İSTATİSTİKLERİ ───
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Mastery dağılımı
    const [mastery] = await db.query(
      `SELECT mastery_level, COUNT(*) as count
       FROM user_words WHERE user_id = ? GROUP BY mastery_level`,
      [userId]
    );

    // Bugünkü istatistik
    const [todayRows] = await db.query(
      `SELECT * FROM daily_stats WHERE user_id = ? AND stat_date = CURDATE()`,
      [userId]
    );
    const today = todayRows[0] || {
      words_studied: 0, words_added: 0, correct_answers: 0,
      wrong_answers: 0, study_time_secs: 0, sessions_count: 0
    };

    // Bugün bekleyen review sayısı
    const [dueCount] = await db.query(
      `SELECT COUNT(*) as count FROM user_words
       WHERE user_id = ? AND (next_review_at IS NULL OR next_review_at <= NOW())
         AND mastery_level NOT IN ('mastered')`,
      [userId]
    );

    // Toplam kelime
    const [totalWords] = await db.query(
      'SELECT COUNT(*) as count FROM user_words WHERE user_id = ?',
      [userId]
    );

    // Streak
    const [streak] = await db.query(
      `WITH ranked_days AS (
        SELECT stat_date,
               DATEDIFF(CURDATE(), stat_date) AS days_ago,
               ROW_NUMBER() OVER (ORDER BY stat_date DESC) - 1 AS row_idx
        FROM daily_stats
        WHERE user_id = ? AND words_studied > 0 AND stat_date <= CURDATE()
      )
      SELECT COUNT(*) AS current_streak FROM ranked_days WHERE days_ago = row_idx`,
      [userId]
    );

    // Son 7 gün
    const [weeklyStats] = await db.query(
      `SELECT stat_date, words_studied, correct_answers, wrong_answers,
              study_time_secs, new_graduated, lapsed_count
       FROM daily_stats
       WHERE user_id = ? AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       ORDER BY stat_date`,
      [userId]
    );

    const masteryMap = { new: 0, learning: 0, reviewing: 0, mastered: 0, leech: 0, relearn: 0 };
    mastery.forEach(m => { masteryMap[m.mastery_level] = m.count; });

    res.json({
      mastery: masteryMap,
      today,
      due_count: dueCount[0].count,
      total_words: totalWords[0].count,
      current_streak: streak[0]?.current_streak || 0,
      weekly: weeklyStats
    });

  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'İstatistikler yüklenirken hata oluştu' });
  }
});

// ─── POS DAĞILIMI ───
router.get('/pos-distribution', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT wpg.pos,
              COUNT(DISTINCT uw.id) AS total,
              SUM(uw.mastery_level = 'new') AS new_count,
              SUM(uw.mastery_level = 'learning') AS learning_count,
              SUM(uw.mastery_level = 'reviewing') AS reviewing_count,
              SUM(uw.mastery_level = 'mastered') AS mastered_count,
              SUM(uw.mastery_level = 'leech') AS leech_count,
              SUM(uw.mastery_level = 'relearn') AS relearn_count
       FROM user_words uw
       JOIN word_sections ws ON ws.user_word_id = uw.id
       JOIN word_pos_groups wpg ON wpg.section_id = ws.id
       WHERE uw.user_id = ?
       GROUP BY wpg.pos ORDER BY total DESC`,
      [req.user.id]
    );

    res.json({ distribution: rows });
  } catch (err) {
    console.error('POS distribution error:', err);
    res.status(500).json({ error: 'POS dağılımı yüklenirken hata oluştu' });
  }
});

// ─── HAFTALIK DETAY ───
router.get('/weekly', auth, async (req, res) => {
  try {
    const { weeks = 4 } = req.query;
    const [rows] = await db.query(
      `SELECT stat_date, words_studied, words_added, correct_answers, wrong_answers,
              ROUND(correct_answers * 100.0 / NULLIF(correct_answers + wrong_answers, 0), 1) AS accuracy_pct,
              study_time_secs, new_graduated, lapsed_count, sessions_count
       FROM daily_stats
       WHERE user_id = ? AND stat_date >= DATE_SUB(CURDATE(), INTERVAL ? WEEK)
       ORDER BY stat_date`,
      [req.user.id, parseInt(weeks)]
    );

    res.json({ stats: rows });
  } catch (err) {
    console.error('Weekly stats error:', err);
    res.status(500).json({ error: 'Haftalık istatistikler yüklenirken hata oluştu' });
  }
});

// ─── LEECH KELİMELER ───
router.get('/leeches', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT uw.id, uw.word, uw.lapse_count, uw.ease_factor, uw.total_reviews,
              ROUND(uw.correct_count * 100.0 / NULLIF(uw.total_reviews, 0), 1) AS accuracy
       FROM user_words uw
       WHERE uw.user_id = ? AND uw.mastery_level = 'leech'
       ORDER BY uw.lapse_count DESC`,
      [req.user.id]
    );

    res.json({ leeches: rows });
  } catch (err) {
    console.error('Leeches error:', err);
    res.status(500).json({ error: 'Leech kelimeler yüklenirken hata oluştu' });
  }
});

module.exports = router;