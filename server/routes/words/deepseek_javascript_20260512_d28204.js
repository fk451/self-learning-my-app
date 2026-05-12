const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// ─── YARDIMCI FONKSİYONLAR ───

/**
 * Kelimelerin etiketlerini tek sorguda çeker
 */
async function fetchTagsForWords(wordIds) {
  if (!wordIds.length) return new Map();
  
  const [tags] = await db.query(
    `SELECT uwt.user_word_id, t.id, t.name, t.color
     FROM user_word_tags uwt
     JOIN tags t ON t.id = uwt.tag_id
     WHERE uwt.user_word_id IN (?)`,
    [wordIds]
  );
  
  const tagsByWordId = new Map();
  tags.forEach(tag => {
    if (!tagsByWordId.has(tag.user_word_id)) {
      tagsByWordId.set(tag.user_word_id, []);
    }
    tagsByWordId.get(tag.user_word_id).push({
      id: tag.id,
      name: tag.name,
      color: tag.color
    });
  });
  
  return tagsByWordId;
}

/**
 * Geçerli sıralama alanını kontrol eder
 */
function validateSortField(sort, allowedSorts) {
  return allowedSorts.includes(sort) ? sort : 'created_at';
}

/**
 * Sayfalama meta verisi oluşturur
 */
function createPaginationMeta(page, limit, total) {
  return {
    page: parseInt(page),
    limit: parseInt(limit),
    total,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Toplu tag ekleme (INSERT IGNORE kullanarak)
 */
async function bulkAddTags(conn, userId, tags, wordId) {
  if (!tags || tags.length === 0) return;
  
  // Benzersiz tagları al
  const uniqueTags = [...new Set(tags)];
  
  // Toplu tag ekleme
  const tagValues = uniqueTags.flatMap(tag => [userId, tag]);
  const tagPlaceholders = uniqueTags.map(() => '(?, ?)').join(',');
  
  await conn.query(
    `INSERT IGNORE INTO tags (user_id, name) VALUES ${tagPlaceholders}`,
    tagValues
  );
  
  // Eklenen tagların ID'lerini çek
  const [tagRows] = await conn.query(
    `SELECT id, name FROM tags WHERE user_id = ? AND name IN (?)`,
    [userId, uniqueTags]
  );
  
  // User-word-tag bağlantılarını toplu ekle
  if (tagRows.length) {
    const linkValues = tagRows.flatMap(tag => [wordId, tag.id]);
    const linkPlaceholders = tagRows.map(() => '(?, ?)').join(',');
    
    await conn.query(
      `INSERT IGNORE INTO user_word_tags (user_word_id, tag_id) VALUES ${linkPlaceholders}`,
      linkValues
    );
  }
}

/**
 * Kelime detayını tek sorguda ağaç yapısına dönüştürür
 */
function buildWordDetailsTree(rows, wordData, tags, history) {
  const word = { ...wordData, tags, review_history: history };
  
  if (!rows || rows.length === 0) {
    word.sections = [];
    word.sentence_examples = [];
    return word;
  }
  
  const sectionsMap = new Map();
  const posGroupsMap = new Map();
  const sensesMap = new Map();
  
  for (const row of rows) {
    // Section
    if (row.section_id && !sectionsMap.has(row.section_id)) {
      sectionsMap.set(row.section_id, {
        id: row.section_id,
        section_word: row.section_word,
        is_base_form: row.is_base_form === 1,
        display_order: row.section_order,
        pos_groups: []
      });
    }
    
    // POS Group
    if (row.pos_id && !posGroupsMap.has(row.pos_id)) {
      const section = sectionsMap.get(row.section_id);
      if (section) {
        const posGroup = {
          id: row.pos_id,
          pos: row.pos,
          display_order: row.pos_order,
          senses: []
        };
        posGroupsMap.set(row.pos_id, posGroup);
        section.pos_groups.push(posGroup);
      }
    }
    
    // Sense
    if (row.sense_id && !sensesMap.has(row.sense_id)) {
      const posGroup = posGroupsMap.get(row.pos_id);
      if (posGroup) {
        const sense = {
          id: row.sense_id,
          definition: row.definition,
          frequency: row.frequency,
          dialect: row.dialect,
          has_exclamation: row.has_exclamation === 1,
          mention_text: row.mention_text,
          mention_sentence: row.mention_sentence,
          display_order: row.sense_order,
          examples: [],
          translations: []
        };
        sensesMap.set(row.sense_id, sense);
        posGroup.senses.push(sense);
      }
    }
    
    // Example
    if (row.example_id && row.example_text) {
      const sense = sensesMap.get(row.sense_id);
      if (sense) {
        sense.examples.push({
          id: row.example_id,
          text: row.example_text,
          display_order: row.example_order
        });
      }
    }
    
    // Translation
    if (row.translation_id && row.translation) {
      const sense = sensesMap.get(row.sense_id);
      if (sense) {
        sense.translations.push({
          id: row.translation_id,
          text: row.translation,
          display_order: row.translation_order
        });
      }
    }
  }
  
  word.sections = Array.from(sectionsMap.values())
    .sort((a, b) => a.display_order - b.display_order);
  
  return word;
}

// ─── ROUTES ───

/**
 * TÜM KELİMELER (filtreli, sayfalı, optimize edilmiş)
 */
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
      where += ` AND EXISTS (
        SELECT 1 FROM user_word_tags uwt 
        JOIN tags t ON t.id = uwt.tag_id 
        WHERE uwt.user_word_id = uw.id AND t.name = ?
      )`;
      params.push(tag);
    }

    const allowedSorts = ['created_at', 'word', 'mastery_level', 'next_review_at', 'total_reviews', 'ease_factor'];
    const sortCol = validateSortField(sort, allowedSorts);
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Toplam sayı (paralel çalışabilir)
    const [[countRows], [words]] = await Promise.all([
      db.query(`SELECT COUNT(*) as total FROM user_words uw ${where}`, params),
      db.query(
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
      )
    ]);

    // N+1 problemi çözüldü: tüm etiketler tek sorguda
    const wordIds = words.map(w => w.id);
    const tagsByWordId = await fetchTagsForWords(wordIds);

    // Etiketleri kelimelere ata
    words.forEach(word => {
      word.tags = tagsByWordId.get(word.id) || [];
    });

    res.json({
      words,
      pagination: createPaginationMeta(page, limit, countRows[0].total)
    });

  } catch (err) {
    console.error('Get words error:', err);
    res.status(500).json({ error: 'Kelimeler yüklenirken hata oluştu' });
  }
});

/**
 * TEK KELİME DETAYI (optimize edilmiş - tek sorgu)
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const wordId = req.params.id;
    const userId = req.user.id;

    // Ana kelime bilgisi
    const [words] = await db.query(
      `SELECT * FROM user_words WHERE id = ? AND user_id = ?`,
      [wordId, userId]
    );

    if (words.length === 0) {
      return res.status(404).json({ error: 'Kelime bulunamadı' });
    }

    const wordData = words[0];

    // Paralel sorgular: detaylar + etiketler + geçmiş
    const [detailRows, tags, history] = await Promise.all([
      db.query(
        `SELECT 
          ws.id as section_id, ws.section_word, ws.is_base_form, ws.display_order as section_order,
          wpg.id as pos_id, wpg.pos, wpg.display_order as pos_order,
          ps.id as sense_id, ps.definition, ps.frequency, ps.dialect, ps.has_exclamation,
          ps.mention_text, ps.mention_sentence, ps.display_order as sense_order,
          se.id as example_id, se.example_text, se.display_order as example_order,
          st.id as translation_id, st.translation, st.display_order as translation_order
         FROM user_words uw
         LEFT JOIN word_sections ws ON ws.user_word_id = uw.id
         LEFT JOIN word_pos_groups wpg ON wpg.section_id = ws.id
         LEFT JOIN pos_senses ps ON ps.pos_group_id = wpg.id
         LEFT JOIN sense_examples se ON se.sense_id = ps.id
         LEFT JOIN sense_translations st ON st.sense_id = ps.id
         WHERE uw.id = ? AND uw.user_id = ?
         ORDER BY 
           ws.display_order, 
           wpg.display_order, 
           ps.display_order, 
           se.display_order, 
           st.display_order`,
        [wordId, userId]
      ),
      db.query(
        `SELECT t.id, t.name, t.color FROM tags t
         JOIN user_word_tags uwt ON uwt.tag_id = t.id
         WHERE uwt.user_word_id = ?`,
        [wordId]
      ),
      db.query(
        `SELECT * FROM review_history 
         WHERE user_word_id = ? 
         ORDER BY reviewed_at DESC 
         LIMIT 20`,
        [wordId]
      )
    ]);

    // Cümle örneklerini ayrı çek (review_history ile karışmasın)
    const [sentenceExamples] = await db.query(
      `SELECT * FROM word_sentence_examples 
       WHERE user_word_id = ? 
       ORDER BY display_order`,
      [wordId]
    );

    // Ağaç yapısını oluştur
    const word = buildWordDetailsTree(detailRows[0], wordData, tags[0], history[0]);
    word.sentence_examples = sentenceExamples[0] || [];

    res.json(word);

  } catch (err) {
    console.error('Get word detail error:', err);
    res.status(500).json({ error: 'Kelime detayı yüklenirken hata oluştu' });
  }
});

/**
 * KELİME EKLE (optimize edilmiş transaction)
 */
router.post('/', auth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const userId = req.user.id;
    const { 
      word, phonetic, source_url, sections = [], 
      sentence_examples = [], tags = [] 
    } = req.body;

    if (!word || !word.trim()) {
      await conn.rollback();
      return res.status(400).json({ error: 'Kelime gerekli' });
    }

    // Duplicate kontrol
    const [existing] = await conn.query(
      'SELECT id FROM user_words WHERE user_id = ? AND word = ?',
      [userId, word]
    );
    
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ 
        error: 'Bu kelime zaten ekli', 
        wordId: existing[0].id 
      });
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
      [userId, word.trim(), phonetic || null, source_url || null, startingEase]
    );
    const wordId = wordResult.insertId;

    // Sections ekle (varsa)
    for (let si = 0; si < sections.length; si++) {
      const sec = sections[si];
      const [secResult] = await conn.query(
        `INSERT INTO word_sections (user_word_id, section_word, is_base_form, display_order)
         VALUES (?, ?, ?, ?)`,
        [wordId, sec.section_word || word, sec.is_base_form ? 1 : 0, si]
      );
      const sectionId = secResult.insertId;

      // POS Groups
      if (sec.pos_groups && sec.pos_groups.length) {
        for (let pi = 0; pi < sec.pos_groups.length; pi++) {
          const pg = sec.pos_groups[pi];
          const [posResult] = await conn.query(
            `INSERT INTO word_pos_groups (section_id, pos, display_order) 
             VALUES (?, ?, ?)`,
            [sectionId, pg.pos || '', pi]
          );
          const posId = posResult.insertId;

          // Senses
          if (pg.senses && pg.senses.length) {
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

              // Toplu example ekleme
              if (sense.examples && sense.examples.length) {
                const exampleValues = sense.examples.flatMap((ex, ei) => [
                  senseId, ex.text || ex, ei
                ]);
                const examplePlaceholders = sense.examples.map(() => '(?, ?, ?)').join(',');
                await conn.query(
                  `INSERT INTO sense_examples (sense_id, example_text, display_order) 
                   VALUES ${examplePlaceholders}`,
                  exampleValues
                );
              }

              // Toplu translation ekleme
              if (sense.translations && sense.translations.length) {
                const translationValues = sense.translations.flatMap((tr, ti) => [
                  senseId, tr.text || tr, ti
                ]);
                const translationPlaceholders = sense.translations.map(() => '(?, ?, ?)').join(',');
                await conn.query(
                  `INSERT INTO sense_translations (sense_id, translation, display_order) 
                   VALUES ${translationPlaceholders}`,
                  translationValues
                );
              }
            }
          }
        }
      }
    }

    // Toplu sentence examples ekleme
    if (sentence_examples.length) {
      const exampleValues = sentence_examples.flatMap((ex, i) => [
        wordId, ex.text || ex, i
      ]);
      const examplePlaceholders = sentence_examples.map(() => '(?, ?, ?)').join(',');
      await conn.query(
        `INSERT INTO word_sentence_examples (user_word_id, sentence_text, display_order) 
         VALUES ${examplePlaceholders}`,
        exampleValues
      );
    }

    // Toplu tag ekleme (optimize edilmiş)
    await bulkAddTags(conn, userId, tags, wordId);

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

/**
 * KELİME GÜNCELLE
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { phonetic, source_url } = req.body;
    
    // Sadece gönderilen alanları güncelle
    const updates = [];
    const values = [];
    
    if (phonetic !== undefined) {
      updates.push('phonetic = ?');
      values.push(phonetic);
    }
    
    if (source_url !== undefined) {
      updates.push('source_url = ?');
      values.push(source_url);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan bulunamadı' });
    }
    
    values.push(req.params.id, req.user.id);
    
    const [result] = await db.query(
      `UPDATE user_words SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
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

/**
 * KELİME SİL
 */
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

/**
 * MASTERY DAĞILIMI
 */
router.get('/stats/mastery', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT mastery_level, COUNT(*) as count
       FROM user_words 
       WHERE user_id = ?
       GROUP BY mastery_level`,
      [req.user.id]
    );

    const stats = { 
      new: 0, learning: 0, reviewing: 0, 
      mastered: 0, leech: 0, relearn: 0 
    };
    
    rows.forEach(r => {
      if (stats.hasOwnProperty(r.mastery_level)) {
        stats[r.mastery_level] = r.count;
      }
    });

    res.json(stats);
  } catch (err) {
    console.error('Mastery stats error:', err);
    res.status(500).json({ error: 'İstatistikler yüklenirken hata oluştu' });
  }
});

module.exports = router;