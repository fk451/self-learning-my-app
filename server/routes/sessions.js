const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ─── OTURUM BAŞLAT ───
router.post('/start', auth, async (req, res) => {
  try {
    const { session_type = 'daily_review', target_pos } = req.body;

    const [result] = await db.query(
      `INSERT INTO study_sessions (user_id, session_type, target_pos) VALUES (?, ?, ?)`,
      [req.user.id, session_type, target_pos || null]
    );

    res.status(201).json({
      session_id: result.insertId,
      message: 'Oturum başlatıldı'
    });
  } catch (err) {
    console.error('Start session error:', err);
    res.status(500).json({ error: 'Oturum başlatılırken hata oluştu' });
  }
});

// ─── OTURUM BİTİR ───
router.put('/:id/complete', auth, async (req, res) => {
  try {
    const { total_cards, correct_cards, wrong_cards, skipped_cards } = req.body;

    await db.query(
      `UPDATE study_sessions SET
        completed_at = NOW(),
        duration_secs = TIMESTAMPDIFF(SECOND, started_at, NOW()),
        total_cards = ?, correct_cards = ?, wrong_cards = ?, skipped_cards = ?
       WHERE id = ? AND user_id = ?`,
      [total_cards || 0, correct_cards || 0, wrong_cards || 0, skipped_cards || 0,
       req.params.id, req.user.id]
    );

    // Günlük istatistik — study time güncelle
    const [session] = await db.query(
      'SELECT duration_secs FROM study_sessions WHERE id = ?',
      [req.params.id]
    );

    if (session.length > 0) {
      await db.query(
        `INSERT INTO daily_stats (user_id, stat_date, study_time_secs, sessions_count)
         VALUES (?, CURDATE(), ?, 1)
         ON DUPLICATE KEY UPDATE
           study_time_secs = study_time_secs + ?,
           sessions_count = sessions_count + 1`,
        [req.user.id, session[0].duration_secs, session[0].duration_secs]
      );
    }

    res.json({ message: 'Oturum tamamlandı' });
  } catch (err) {
    console.error('Complete session error:', err);
    res.status(500).json({ error: 'Oturum tamamlanırken hata oluştu' });
  }
});

// ─── OTURUM GEÇMİŞİ ───
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [sessions] = await db.query(
      `SELECT * FROM study_sessions
       WHERE user_id = ?
       ORDER BY started_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );

    res.json({ sessions });
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Oturumlar yüklenirken hata oluştu' });
  }
});

module.exports = router;