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

    const allowedSorts = ['created_at', 'word', 'mastery_level', 'next_review_at', 'total_reviews', 'ease_factor'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Tag filtresi varsa JOIN, yoksa yok
    const tagJoin = tag
      ? `JOIN user_word_tags uwt_f ON uwt_f.user_word_id = uw.id
         JOIN tags t_f ON t_f.id = uwt_f.tag_id AND t_f.user_id = ? AND t_f.name = ?`
      : '';

    let where = 'WHERE uw.user_id = ?';
    const params = tag ? [userId, userId, tag] : [userId];

    if (mastery) {
      where += ' AND uw.mastery_level = ?';
      params.push(mastery);
    }

    if (search) {
      where += ' AND uw.word LIKE ?';
      params.push(`%${search}%`);
    }

    // Tek sorguda hem kelimeler hem toplam sayı (window function)
    const [words] = await db.query(
      `SELECT uw.id, uw.word, uw.phonetic, uw.source_url, uw.mastery_level,
              uw.ease_factor, uw.interval_days, uw.repetition, uw.current_step,
              uw.next_review_at, uw.last_reviewed_at,
              uw.total_reviews, uw.correct_count, uw.wrong_count,
              uw.streak, uw.best_streak, uw.lapse_count, uw.created_at,
              COUNT(*) OVER() AS total_count
       FROM user_words uw
       ${tagJoin}
       ${where}
       ORDER BY uw.${sortCol} ${sortOrder}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    const total = words.length > 0 ? Number(words[0].total_count) : 0;

    // Tag'leri tek sorguda çek, JS'de grupla — N+1 sorunu ortadan kalkar
    if (words.length > 0) {
      const wordIds = words.map(w => w.id);

      const [allTags] = await db.query(
        `SELECT uwt.user_word_id, t.id, t.name, t.color
         FROM tags t
         JOIN user_word_tags uwt ON uwt.tag_id = t.id
         WHERE uwt.user_word_id IN (?)`,
        [wordIds]
      );

      const tagMap = {};
      for (const tag of allTags) {
        if (!tagMap[tag.user_word_id]) tagMap[tag.user_word_id] = [];
        tagMap[tag.user_word_id].push({ id: tag.id, name: tag.name, color: tag.color });
      }

      for (const word of words) {
        delete word.total_count;
        word.tags = tagMap[word.id] || [];
      }
    }

    res.json({
      words,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
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

    // Sections → POS → Senses → Examples + Translations
    // Tek JOIN sorgusunda tüm hiyerarşiyi çek (önceki: 20-50+ sorgu → 1 sorgu)
    const [detailRows] = await db.query(
      `SELECT
         ws.id          AS section_id,
         ws.section_word,
         ws.is_base_form,
         ws.display_order AS sec_order,
         pg.id          AS pos_id,
         pg.pos,
         pg.display_order AS pos_order,
         ps.id          AS sense_id,
         ps.definition,
         ps.frequency,
         ps.dialect,
         ps.has_exclamation,
         ps.mention_text,
         ps.mention_sentence,
         ps.display_order AS sense_order,
         se.id          AS ex_id,
         se.example_text,
         se.display_order AS ex_order,
         st.id          AS tr_id,
         st.translation,
         st.display_order AS tr_order
       FROM word_sections ws
       LEFT JOIN word_pos_groups pg ON pg.section_id = ws.id
       LEFT JOIN pos_senses ps      ON ps.pos_group_id = pg.id
       LEFT JOIN sense_examples se  ON se.sense_id = ps.id
       LEFT JOIN sense_translations st ON st.sense_id = ps.id
       WHERE ws.user_word_id = ?
       ORDER BY ws.display_order, pg.display_order, ps.display_order, se.display_order, st.display_order`,
      [word.id]
    );

    // Düz satırları hiyerarşik yapıya dönüştür
    const sections = buildSectionHierarchy(detailRows);

    // Geri kalan sorgular bağımsız — paralel çalıştır
    const [
      [sentenceExamples],
      [tags],
      [history]
    ] = await Promise.all([
      db.query(
        `SELECT * FROM word_sentence_examples WHERE user_word_id = ? ORDER BY display_order`,
        [word.id]
      ),
      db.query(
        `SELECT t.id, t.name, t.color FROM tags t
         JOIN user_word_tags uwt ON uwt.tag_id = t.id
         WHERE uwt.user_word_id = ?`,
        [word.id]
      ),
      db.query(
        `SELECT * FROM review_history WHERE user_word_id = ? ORDER BY reviewed_at DESC LIMIT 20`,
        [word.id]
      )
    ]);

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

/**
 * JOIN sonucu gelen düz satırları section → pos → sense → examples/translations
 * hiyerarşisine dönüştürür.
 */
function buildSectionHierarchy(rows) {
  const sectionMap = new Map();

  for (const row of rows) {
    // Section
    if (!sectionMap.has(row.section_id)) {
      sectionMap.set(row.section_id, {
        id: row.section_id,
        section_word: row.section_word,
        is_base_form: row.is_base_form,
        display_order: row.sec_order,
        pos_groups: new Map()
      });
    }
    const section = sectionMap.get(row.section_id);

    if (!row.pos_id) continue;

    // POS group
    if (!section.pos_groups.has(row.pos_id)) {
      section.pos_groups.set(row.pos_id, {
        id: row.pos_id,
        pos: row.pos,
        display_order: row.pos_order,
        senses: new Map()
      });
    }
    const posGroup = section.pos_groups.get(row.pos_id);

    if (!row.sense_id) continue;

    // Sense
    if (!posGroup.senses.has(row.sense_id)) {
      posGroup.senses.set(row.sense_id, {
        id: row.sense_id,
        definition: row.definition,
        frequency: row.frequency,
        dialect: row.dialect,
        has_exclamation: row.has_exclamation,
        mention_text: row.mention_text,
        mention_sentence: row.mention_sentence,
        display_order: row.sense_order,
        examples: new Map(),
        translations: new Map()
      });
    }
    const sense = posGroup.senses.get(row.sense_id);

    // Example (LEFT JOIN tekrar ettirebilir, Map ile deduplicate)
    if (row.ex_id && !sense.examples.has(row.ex_id)) {
      sense.examples.set(row.ex_id, {
        id: row.ex_id,
        example_text: row.example_text,
        display_order: row.ex_order
      });
    }

    // Translation
    if (row.tr_id && !sense.translations.has(row.tr_id)) {
      sense.translations.set(row.tr_id, {
        id: row.tr_id,
        translation: row.translation,
        display_order: row.tr_order
      });
    }
  }

  // Map'leri diziye çevir
  return [...sectionMap.values()].map(section => ({
    ...section,
    pos_groups: [...section.pos_groups.values()].map(pos => ({
      ...pos,
      senses: [...pos.senses.values()].map(sense => ({
        ...sense,
        examples: [...sense.examples.values()],
        translations: [...sense.translations.values()]
      }))
    }))
  }));
}

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

    // Duplicate kontrol + starting_ease tek sorguda
    const [[existing], [settingsRows]] = await Promise.all([
      conn.query(
        'SELECT id FROM user_words WHERE user_id = ? AND word = ?',
        [userId, word]
      ),
      conn.query(
        'SELECT starting_ease FROM user_settings WHERE user_id = ?',
        [userId]
      )
    ]);

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Bu kelime zaten ekli', wordId: existing[0].id });
    }

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

        if (sec.pos_groups && sec.pos_groups.length > 0) {
          for (let pi = 0; pi < sec.pos_groups.length; pi++) {
            const pg = sec.pos_groups[pi];
            const [posResult] = await conn.query(
              `INSERT INTO word_pos_groups (section_id, pos, display_order) VALUES (?, ?, ?)`,
              [sectionId, pg.pos || '', pi]
            );
            const posId = posResult.insertId;

            if (pg.senses && pg.senses.length > 0) {
              for (let ssi = 0; ssi < pg.senses.length; ssi++) {
                const sense = pg.senses[ssi];
                const [senseResult] = await conn.query(
                  `INSERT INTO pos_senses
                     (pos_group_id, definition, frequency, dialect, has_exclamation,
                      mention_text, mention_sentence, display_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [posId, sense.definition, sense.frequency || null,
                   sense.dialect || null, sense.has_exclamation ? 1 : 0,
                   sense.mention_text || null, sense.mention_sentence || null, ssi]
                );
                const senseId = senseResult.insertId;

                // Batch INSERT: examples
                if (sense.examples && sense.examples.length > 0) {
                  const exampleValues = sense.examples.map((ex, ei) => [
                    senseId, ex.text || ex, ei
                  ]);
                  await conn.query(
                    `INSERT INTO sense_examples (sense_id, example_text, display_order) VALUES ?`,
                    [exampleValues]
                  );
                }

                // Batch INSERT: translations
                if (sense.translations && sense.translations.length > 0) {
                  const translationValues = sense.translations.map((tr, ti) => [
                    senseId, tr.text || tr, ti
                  ]);
                  await conn.query(
                    `INSERT INTO sense_translations (sense_id, translation, display_order) VALUES ?`,
                    [translationValues]
                  );
                }
              }
            }
          }
        }
      }
    }

    // Batch INSERT: sentence examples
    if (sentence_examples && sentence_examples.length > 0) {
      const sentenceValues = sentence_examples.map((s, i) => [
        wordId, s.text || s, i
      ]);
      await conn.query(
        `INSERT INTO word_sentence_examples (user_word_id, sentence_text, display_order) VALUES ?`,
        [sentenceValues]
      );
    }

    // Tags: INSERT IGNORE + LAST_INSERT_ID trick ile tek sorguda id al
    if (tags && tags.length > 0) {
      for (const tagName of tags) {
        // INSERT IGNORE ile varsa atla, yoksa ekle; her iki durumda da id'yi LAST_INSERT_ID ile al
        await conn.query(
          `INSERT INTO tags (user_id, name)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
          [userId, tagName]
        );
        const [[{ tagId }]] = await conn.query('SELECT LAST_INSERT_ID() AS tagId');

        await conn.query(
          'INSERT IGNORE INTO user_word_tags (user_word_id, tag_id) VALUES (?, ?)',
          [wordId, tagId]
        );
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
      `UPDATE user_words
       SET phonetic    = COALESCE(?, phonetic),
           source_url  = COALESCE(?, source_url)
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
