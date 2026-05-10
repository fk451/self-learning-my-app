const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ─── TÜM ETİKETLER ───
router.get('/', auth, async (req, res) => {
  try {
    const [tags] = await db.query(
      `SELECT t.id, t.name, t.color, COUNT(uwt.user_word_id) AS word_count
       FROM tags t
       LEFT JOIN user_word_tags uwt ON uwt.tag_id = t.id
       WHERE t.user_id = ?
       GROUP BY t.id
       ORDER BY t.name`,
      [req.user.id]
    );
    res.json({ tags });
  } catch (err) {
    console.error('Get tags error:', err);
    res.status(500).json({ error: 'Etiketler yüklenirken hata oluştu' });
  }
});

// ─── ETİKET OLUŞTUR ───
router.post('/', auth, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Etiket adı gerekli' });

    const [result] = await db.query(
      'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)',
      [req.user.id, name, color || '#6b7280']
    );

    res.status(201).json({ id: result.insertId, name, color: color || '#6b7280' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Bu etiket zaten var' });
    }
    console.error('Create tag error:', err);
    res.status(500).json({ error: 'Etiket oluşturulurken hata oluştu' });
  }
});

// ─── ETİKET GÜNCELLE ───
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, color } = req.body;
    await db.query(
      'UPDATE tags SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ? AND user_id = ?',
      [name, color, req.params.id, req.user.id]
    );
    res.json({ message: 'Etiket güncellendi' });
  } catch (err) {
    console.error('Update tag error:', err);
    res.status(500).json({ error: 'Etiket güncellenirken hata oluştu' });
  }
});

// ─── ETİKET SİL ───
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM tags WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Etiket silindi' });
  } catch (err) {
    console.error('Delete tag error:', err);
    res.status(500).json({ error: 'Etiket silinirken hata oluştu' });
  }
});

// ─── KELİMEYE ETİKET EKLE ───
router.post('/assign', auth, async (req, res) => {
  try {
    const { word_id, tag_id } = req.body;

    // Kelime ve etiket kullanıcıya ait mi?
    const [word] = await db.query('SELECT id FROM user_words WHERE id = ? AND user_id = ?', [word_id, req.user.id]);
    const [tag] = await db.query('SELECT id FROM tags WHERE id = ? AND user_id = ?', [tag_id, req.user.id]);

    if (word.length === 0 || tag.length === 0) {
      return res.status(404).json({ error: 'Kelime veya etiket bulunamadı' });
    }

    await db.query('INSERT IGNORE INTO user_word_tags (user_word_id, tag_id) VALUES (?, ?)', [word_id, tag_id]);
    res.json({ message: 'Etiket atandı' });
  } catch (err) {
    console.error('Assign tag error:', err);
    res.status(500).json({ error: 'Etiket atanırken hata oluştu' });
  }
});

// ─── KELİMEDEN ETİKET KALDIR ───
router.delete('/unassign/:wordId/:tagId', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM user_word_tags WHERE user_word_id = ? AND tag_id = ?',
      [req.params.wordId, req.params.tagId]);
    res.json({ message: 'Etiket kaldırıldı' });
  } catch (err) {
    console.error('Unassign tag error:', err);
    res.status(500).json({ error: 'Etiket kaldırılırken hata oluştu' });
  }
});

module.exports = router;