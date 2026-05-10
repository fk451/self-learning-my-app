const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ─── BİLDİRİM ZAMANLAMA LİSTESİ ───
router.get('/schedules', auth, async (req, res) => {
  try {
    const [schedules] = await db.query(
      'SELECT * FROM notification_schedules WHERE user_id = ? ORDER BY notify_time',
      [req.user.id]
    );
    res.json({ schedules });
  } catch (err) {
    console.error('Get schedules error:', err);
    res.status(500).json({ error: 'Bildirim zamanlamaları yüklenirken hata oluştu' });
  }
});

// ─── ZAMANLAMA OLUŞTUR/GÜNCELLE ───
router.post('/schedules', auth, async (req, res) => {
  try {
    const { schedule_type, notify_time, days_of_week, is_enabled, notify_via, min_due_words } = req.body;

    const [result] = await db.query(
      `INSERT INTO notification_schedules
        (user_id, schedule_type, notify_time, days_of_week, is_enabled, notify_via, min_due_words)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, schedule_type || 'daily', notify_time || '09:00:00',
       days_of_week || '1,2,3,4,5,6,7', is_enabled !== false ? 1 : 0,
       notify_via || 'push', min_due_words || 5]
    );

    res.status(201).json({ id: result.insertId, message: 'Zamanlama oluşturuldu' });
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ error: 'Zamanlama oluşturulurken hata oluştu' });
  }
});

router.put('/schedules/:id', auth, async (req, res) => {
  try {
    const { schedule_type, notify_time, days_of_week, is_enabled, notify_via, min_due_words } = req.body;

    await db.query(
      `UPDATE notification_schedules SET
        schedule_type = COALESCE(?, schedule_type),
        notify_time = COALESCE(?, notify_time),
        days_of_week = COALESCE(?, days_of_week),
        is_enabled = COALESCE(?, is_enabled),
        notify_via = COALESCE(?, notify_via),
        min_due_words = COALESCE(?, min_due_words)
       WHERE id = ? AND user_id = ?`,
      [schedule_type, notify_time, days_of_week, is_enabled, notify_via, min_due_words,
       req.params.id, req.user.id]
    );

    res.json({ message: 'Zamanlama güncellendi' });
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).json({ error: 'Zamanlama güncellenirken hata oluştu' });
  }
});

router.delete('/schedules/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM notification_schedules WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]);
    res.json({ message: 'Zamanlama silindi' });
  } catch (err) {
    console.error('Delete schedule error:', err);
    res.status(500).json({ error: 'Zamanlama silinirken hata oluştu' });
  }
});

// ─── BİLDİRİM GEÇMİŞİ ───
router.get('/logs', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE user_id = ?';
    const params = [req.user.id];

    if (unread_only === 'true') {
      where += ' AND is_read = 0';
    }

    const [logs] = await db.query(
      `SELECT * FROM notification_logs ${where} ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const [unread] = await db.query(
      'SELECT COUNT(*) as count FROM notification_logs WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );

    res.json({ logs, unread_count: unread[0].count });
  } catch (err) {
    console.error('Get notification logs error:', err);
    res.status(500).json({ error: 'Bildirim kayıtları yüklenirken hata oluştu' });
  }
});

// ─── BİLDİRİMİ OKUNDU İŞARETLE ───
router.put('/logs/:id/read', auth, async (req, res) => {
  try {
    await db.query(
      'UPDATE notification_logs SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Bildirim okundu işaretlendi' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'İşlem sırasında hata oluştu' });
  }
});

// ─── TÜM BİLDİRİMLERİ OKUNDU İŞARETLE ───
router.put('/logs/read-all', auth, async (req, res) => {
  try {
    await db.query(
      'UPDATE notification_logs SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ message: 'Tüm bildirimler okundu işaretlendi' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'İşlem sırasında hata oluştu' });
  }
});

module.exports = router;