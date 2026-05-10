const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');
const { getDefaultSettings } = require('../services/sm2');

// ─── KAYIT ───
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, display_name } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({ error: 'Email, kullanıcı adı ve şifre gerekli' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
    }

    // Var mı kontrolü
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Bu email veya kullanıcı adı zaten kullanılıyor' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      `INSERT INTO users (email, username, password_hash, display_name) VALUES (?, ?, ?, ?)`,
      [email, username, password_hash, display_name || username]
    );

    const userId = result.insertId;

    // Varsayılan ayarları oluştur
    const defaults = getDefaultSettings();
    await db.query(
      `INSERT INTO user_settings (user_id, new_cards_per_day, max_reviews_per_day,
        learning_steps, relearn_steps, graduating_interval, easy_interval,
        starting_ease, minimum_ease, easy_bonus, interval_modifier,
        max_interval, lapse_penalty, lapse_ease_penalty, leech_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, defaults.new_cards_per_day, defaults.max_reviews_per_day,
       defaults.learning_steps, defaults.relearn_steps, defaults.graduating_interval,
       defaults.easy_interval, defaults.starting_ease, defaults.minimum_ease,
       defaults.easy_bonus, defaults.interval_modifier, defaults.max_interval,
       defaults.lapse_penalty, defaults.lapse_ease_penalty, defaults.leech_threshold]
    );

    // Varsayılan bildirim zamanlaması
    await db.query(
      `INSERT INTO notification_schedules (user_id, schedule_type, notify_time) VALUES (?, 'daily', '09:00:00')`,
      [userId]
    );

    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    res.status(201).json({
      message: 'Kayıt başarılı',
      token,
      user: { id: userId, email, username, display_name: display_name || username }
    });

  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
  }
});

// ─── GİRİŞ ───
router.post('/login', async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Email/kullanıcı adı ve şifre gerekli' });
    }

    const [rows] = await db.query(
      'SELECT * FROM users WHERE (email = ? OR username = ?) AND is_active = 1',
      [login, login]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Geçersiz kimlik bilgileri' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Geçersiz kimlik bilgileri' });
    }

    // Son giriş zamanını güncelle
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        display_name: user.display_name,
        timezone: user.timezone,
        preferred_lang: user.preferred_lang,
        daily_goal: user.daily_goal
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
  }
});

// ─── PROFİL ───
router.get('/me', auth, (req, res) => {
  res.json({ user: req.user });
});

// ─── PROFİL GÜNCELLE ───
router.put('/me', auth, async (req, res) => {
  try {
    const { display_name, timezone, preferred_lang, daily_goal } = req.body;

    await db.query(
      `UPDATE users SET display_name = COALESCE(?, display_name),
        timezone = COALESCE(?, timezone),
        preferred_lang = COALESCE(?, preferred_lang),
        daily_goal = COALESCE(?, daily_goal)
       WHERE id = ?`,
      [display_name, timezone, preferred_lang, daily_goal, req.user.id]
    );

    res.json({ message: 'Profil güncellendi' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Profil güncellenirken hata oluştu' });
  }
});

module.exports = router;