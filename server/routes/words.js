const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ─── TÜM KELİMELER (filtreli, sayfalı) ───
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 30,
      mastery,
      tag,
      search,
      sort = 'created_at',
      order = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    let where = 'WHERE uw.user_id = ?';
    const params = [userId];

    if (mastery) {
      where += ' AND uw.mastery_level = ?';
      params.push(mastery);
    }

    if (search) {
      where += ' AND uw.word LIKE ?';
      params.push(`%${search}%`);
    }

    if (tag) {
      where += ' AND EXISTS (SELECT 1 FROM user_word_tags uwt JOIN tags t ON t.id = uwt.tag_id WHERE uwt.user_word_id = uw.id AND t.name = ?)';
      params.push(tag);
    }

    const allowedSorts = ['created_at', 'word', 'mastery_level', 'next_review_at', 'total_reviews', 'ease_factor'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Toplam sayı
    const [countRows] = await db.query(
      `SELECT COUNT(*) as total FROM user_words uw ${where}`, params
    );

    // Kelimeler
    const [words] = await db.query(
      `SELECT uw.id, uw.word, uw.phonetic, uw.source_url, uw.mastery_level,
              uw.ease_factor, uw.interval_days, uw.repetition, uw.current_step,
              uw.next_review_at, uw.last_reviewed_at,
              uw.total_reviews, uw.correct_count, uw.wrong_count,
              uw.streak, uw.best_streak, uw.lapse_count, uw.created_at
       FROM user_words uw
       ${where}
       ORDER BY uw.${sortCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Her kelime için etiketleri getir
    for (const word of words) {
      const [tags] = await db.query(
        `SELECT t.id, t.name, t.color FROM tags t
         JOIN user_word_tags uwt ON uwt.tag_id = t.id
         WHERE uwt.user_word_id = ?`,
        [word.id]
      );
      word.tags = tags;
    }

    res.json({
      words,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countRows[0].total,
        totalPages: Math.ceil(countRows[0].total / limit)
      }
    });

  } catch (err) {
    console.error('Get words error:', err);
    res.status(500).json({ error: 'Kelimeler yüklenirken hata oluştu' });
  }
});

// ─── TEK KELİME DETAY ───
router.get('/:id', auth, async (req, res) => {
  try {
    const [words] = await db.query(
      `SELECT * FROM user_words WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (words.length === 0) {
      return res.status(404).json({ error: 'Kelime bulunamadı' });
    }

    const word = words[0];

    // Sections + POS + Senses + Examples + Translations
    const [sections] = await db.query(
      `SELECT * FROM word_sections WHERE user_word_id = ? ORDER BY display_order`,
      [word.id]
    );

    for (const section of sections) {
      const [posGroups] = await db.query(
        `SELECT * FROM word_pos_groups WHERE section_id = ? ORDER BY display_order`,
        [section.id]
      );

      for (const pos of posGroups) {
        const [senses] = await db.query(
          `SELECT * FROM pos_senses WHERE pos_group_id = ? ORDER BY display_order`,
          [pos.id]
        );

        for (const sense of senses) {
          const [examples] = await db.query(
            `SELECT * FROM sense_examples WHERE sense_id = ? ORDER BY display_order`,
            [sense.id]
          );
          const [translations] = await db.query(
            `SELECT * FROM sense_translations WHERE sense_id = ? ORDER BY display_order`,
            [sense.id]
          );
          sense.examples = examples;
          sense.translations = translations;
        }
        pos.senses = senses;
      }
      section.pos_groups = posGroups;
    }

    // Cümle örnekleri
    const [sentenceExamples] = await db.query(
      `SELECT * FROM word_sentence_examples WHERE user_word_id = ? ORDER BY display_order`,
      [word.id]
    );

    // Etiketler
    const [tags] = await db.query(
      `SELECT t.id, t.name, t.color FROM tags t
       JOIN user_word_tags uwt ON uwt.tag_id = t.id
       WHERE uwt.user_word_id = ?`,
      [word.id]
    );

    // Review geçmişi (son 20)
    const [history] = await db.query(
      `SELECT * FROM review_history WHERE user_word_id = ? ORDER BY reviewed_at DESC LIMIT 20`,
      [word.id]
    );

    res.json({
      ...word,
      sections,
      sentence_examples: sentenceExamples,
      tags,
      review_history: history
    });

  } catch (err) {
    console.error('Get word detail error:', err);
    res.status(500).json({ error: 'Kelime detayı yüklenirken hata oluştu' });
  }
});

// ─── KELİME EKLE ───
router.post('/', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const userId = req.user.id;
    const { word, phonetic, source_url, sections, sentence_examples, tags } = req.body;

    if (!word) {
      return res.status(400).json({ error: 'Kelime gerekli' });
    }

    // Duplicate kontrol
    const [existing] = await conn.query(
      'SELECT id FROM user_words WHERE user_id = ? AND word = ?',
      [userId, word]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Bu kelime zaten ekli', wordId: existing[0].id });
    }

    // Kullanıcı ayarlarından starting_ease al
    const [settingsRows] = await conn.query(
      'SELECT starting_ease FROM user_settings WHERE user_id = ?',
      [userId]
    );
    const startingEase = settingsRows.length > 0 ? settingsRows[0].starting_ease : 2.30;

    // Ana kelime kaydı
    const [wordResult] = await conn.query(
      `INSERT INTO user_words (user_id, word, phonetic, source_url, ease_factor, mastery_level)
       VALUES (?, ?, ?, ?, ?, 'new')`,
      [userId, word, phonetic || null, source_url || null, startingEase]
    );
    const wordId = wordResult.insertId;

    // Sections
    if (sections && sections.length > 0) {
      for (let si = 0; si < sections.length; si++) {
        const sec = sections[si];
        const [secResult] = await conn.query(
          `INSERT INTO word_sections (user_word_id, section_word, is_base_form, display_order)
           VALUES (?, ?, ?, ?)`,
          [wordId, sec.section_word || word, sec.is_base_form ? 1 : 0, si]
        );
        const sectionId = secResult.insertId;

        // POS Groups
        if (sec.pos_groups) {
          for (let pi = 0; pi < sec.pos_groups.length; pi++) {
            const pg = sec.pos_groups[pi];
            const [posResult] = await conn.query(
              `INSERT INTO word_pos_groups (section_id, pos, display_order) VALUES (?, ?, ?)`,
              [sectionId, pg.pos || '', pi]
            );
            const posId = posResult.insertId;

            // Senses
            if (pg.senses) {
              for (let ssi = 0; ssi < pg.senses.length; ssi++) {
                const sense = pg.senses[ssi];
                const [senseResult] = await conn.query(
                  `INSERT INTO pos_senses (pos_group_id, definition, frequency, dialect, has_exclamation, mention_text, mention_sentence, display_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [posId, sense.definition, sense.frequency || null,
                   sense.dialect || null, sense.has_exclamation ? 1 : 0,
                   sense.mention_text || null, sense.mention_sentence || null, ssi]
                );
                const senseId = senseResult.insertId;

                // Examples
                if (sense.examples) {
                  for (let ei = 0; ei < sense.examples.length; ei++) {
                    await conn.query(
                      `INSERT INTO sense_examples (sense_id, example_text, display_order) VALUES (?, ?, ?)`,
                      [senseId, sense.examples[ei].text || sense.examples[ei], ei]
                    );
                  }
                }

                // Translations
                if (sense.translations) {
                  for (let ti = 0; ti < sense.translations.length; ti++) {
                    await conn.query(
                      `INSERT INTO sense_translations (sense_id, translation, display_order) VALUES (?, ?, ?)`,
                      [senseId, sense.translations[ti].text || sense.translations[ti], ti]
                    );
                  }
                }
              }
            }
          }
        }
      }
    }

    // Sentence examples
    if (sentence_examples && sentence_examples.length > 0) {
      for (let i = 0; i < sentence_examples.length; i++) {
        await conn.query(
          `INSERT INTO word_sentence_examples (user_word_id, sentence_text, display_order) VALUES (?, ?, ?)`,
          [wordId, sentence_examples[i].text || sentence_examples[i], i]
        );
      }
    }

    // Tags
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        // Tag yoksa oluştur
        await conn.query(
          `INSERT IGNORE INTO tags (user_id, name) VALUES (?, ?)`,
          [userId, tagName]
        );
        const [tagRows] = await conn.query(
          'SELECT id FROM tags WHERE user_id = ? AND name = ?',
          [userId, tagName]
        );
        if (tagRows.length > 0) {
          await conn.query(
            'INSERT IGNORE INTO user_word_tags (user_word_id, tag_id) VALUES (?, ?)',
            [wordId, tagRows[0].id]
          );
        }
      }
    }

    // Günlük istatistik güncelle
    await conn.query(
      `INSERT INTO daily_stats (user_id, stat_date, words_added)
       VALUES (?, CURDATE(), 1)
       ON DUPLICATE KEY UPDATE words_added = words_added + 1`,
      [userId]
    );

    await conn.commit();

    res.status(201).json({ message: 'Kelime eklendi', wordId });

  } catch (err) {
    await conn.rollback();
    console.error('Add word error:', err);
    res.status(500).json({ error: 'Kelime eklenirken hata oluştu' });
  } finally {
    conn.release();
  }
});

// ─── KELİME GÜNCELLE ───
router.put('/:id', auth, async (req, res) => {
  try {
    const { phonetic, source_url } = req.body;

    const [result] = await db.query(
      `UPDATE user_words SET phonetic = COALESCE(?, phonetic), source_url = COALESCE(?, source_url)
       WHERE id = ? AND user_id = ?`,
      [phonetic, source_url, req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kelime bulunamadı' });
    }

    res.json({ message: 'Kelime güncellendi' });
  } catch (err) {
    console.error('Update word error:', err);
    res.status(500).json({ error: 'Kelime güncellenirken hata oluştu' });
  }
});

// ─── KELİME SİL ───
router.delete('/:id', auth, async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM user_words WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kelime bulunamadı' });
    }

    res.json({ message: 'Kelime silindi' });
  } catch (err) {
    console.error('Delete word error:', err);
    res.status(500).json({ error: 'Kelime silinirken hata oluştu' });
  }
});

// ─── MASTERY DAĞILIMI ───
router.get('/stats/mastery', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT mastery_level, COUNT(*) as count
       FROM user_words WHERE user_id = ?
       GROUP BY mastery_level`,
      [req.user.id]
    );

    const stats = { new: 0, learning: 0, reviewing: 0, mastered: 0, leech: 0, relearn: 0 };
    rows.forEach(r => { stats[r.mastery_level] = r.count; });

    res.json(stats);
  } catch (err) {
    console.error('Mastery stats error:', err);
    res.status(500).json({ error: 'İstatistikler yüklenirken hata oluştu' });
  }
});

module.exports = router;