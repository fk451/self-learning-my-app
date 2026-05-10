const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ─── AYARLARI GETİR ───
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.json({ settings: require('../services/sm2').getDefaultSettings() });
    }

    res.json({ settings: rows[0] });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Ayarlar yüklenirken hata oluştu' });
  }
});

// ─── AYARLARI GÜNCELLE ───
router.put('/', auth, async (req, res) => {
  try {
    const fields = [
      'new_cards_per_day', 'max_reviews_per_day', 'learning_steps', 'relearn_steps',
      'graduating_interval', 'easy_interval', 'starting_ease', 'minimum_ease',
      'easy_bonus', 'interval_modifier', 'max_interval', 'lapse_penalty',
      'lapse_ease_penalty', 'leech_threshold', 'quiz_mode', 'show_phonetic',
      'show_examples', 'theme'
    ];

    const updates = [];
    const values = [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan belirtilmedi' });
    }

    values.push(req.user.id);

    await db.query(
      `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`,
      values
    );

    res.json({ message: 'Ayarlar güncellendi' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Ayarlar güncellenirken hata oluştu' });
  }
});

module.exports = router;