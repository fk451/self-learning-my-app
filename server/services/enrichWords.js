const db = require('../db');

/**
 * Kelime listesini toplu sorgularla zenginleştirir.
 * N+1 query probleminden kurtulmak için tüm verileri 5 sabit sorguda çeker.
 * 
 * @param {Array} words - user_words dizisi
 * @returns {Promise<void>}
 */
async function enrichWordsBatch(words) {
  if (!words || words.length === 0) return;

  const wordIds = words.map(w => w.id);

  // 1. Tüm section'ları tek seferde çek
  const [sections] = await db.query(
    `SELECT id, user_word_id, section_word, is_base_form, display_order
     FROM word_sections 
     WHERE user_word_id IN (?)
     ORDER BY display_order`,
    [wordIds]
  );

  if (sections.length === 0) {
    // Hiç section yoksa boş diziler ata
    words.forEach(w => {
      w.sections = [];
      w.pos_groups = [];
    });
    return;
  }

  const sectionIds = sections.map(s => s.id);

  // 2. Tüm POS gruplarını tek seferde çek
  const [posGroups] = await db.query(
    `SELECT id, section_id, pos, display_order
     FROM word_pos_groups 
     WHERE section_id IN (?)
     ORDER BY display_order`,
    [sectionIds]
  );

  const posGroupIds = posGroups.map(pg => pg.id);

  // 3. Tüm sense'leri tek seferde çek
  const [senses] = await db.query(
    `SELECT id, pos_group_id, definition, frequency, dialect, 
            has_exclamation, mention_text, mention_sentence, display_order
     FROM pos_senses 
     WHERE pos_group_id IN (?)
     ORDER BY display_order`,
    [posGroupIds]
  );

  const senseIds = senses.map(s => s.id);

  // 4. Tüm çevirileri tek seferde çek
  const [translations] = await db.query(
    `SELECT id, sense_id, translation, display_order
     FROM sense_translations 
     WHERE sense_id IN (?)
     ORDER BY display_order`,
    [senseIds]
  );

  // 5. Tüm örnek cümleleri tek seferde çek (her sense için max 2)
  const [examples] = await db.query(
    `SELECT id, sense_id, example_text, display_order
     FROM sense_examples 
     WHERE sense_id IN (?)
     ORDER BY display_order
     LIMIT 1000`, // Toplam limit, her sense için ayrı limit uygulanacak
    [senseIds]
  );

  // ---- Verileri Map yapılarına dönüştür ----

  // Translation map: sense_id -> [translation, ...]
  const translationMap = new Map();
  for (const t of translations) {
    if (!translationMap.has(t.sense_id)) {
      translationMap.set(t.sense_id, []);
    }
    translationMap.get(t.sense_id).push(t.translation);
  }

  // Example map: sense_id -> [example_text, ...] (max 2)
  const exampleMap = new Map();
  for (const e of examples) {
    if (!exampleMap.has(e.sense_id)) {
      exampleMap.set(e.sense_id, []);
    }
    const exampleList = exampleMap.get(e.sense_id);
    if (exampleList.length < 2) { // Her sense için en fazla 2 örnek
      exampleList.push(e.example_text);
    }
  }

  // Sense map: pos_group_id -> [sense_object, ...]
  const senseMap = new Map();
  for (const s of senses) {
    if (!senseMap.has(s.pos_group_id)) {
      senseMap.set(s.pos_group_id, []);
    }
    senseMap.get(s.pos_group_id).push({
      id: s.id,
      definition: s.definition,
      frequency: s.frequency,
      dialect: s.dialect,
      has_exclamation: s.has_exclamation,
      mention_text: s.mention_text,
      mention_sentence: s.mention_sentence,
      translations: translationMap.get(s.id) || [],
      examples: exampleMap.get(s.id) || []
    });
  }

  // POS Group map: section_id -> [{pos, senses}, ...]
  const posGroupMap = new Map();
  for (const pg of posGroups) {
    if (!posGroupMap.has(pg.section_id)) {
      posGroupMap.set(pg.section_id, []);
    }
    posGroupMap.get(pg.section_id).push({
      id: pg.id,
      pos: pg.pos,
      senses: senseMap.get(pg.id) || []
    });
  }

  // Section map: user_word_id -> [section_object, ...]
  const sectionMap = new Map();
  for (const s of sections) {
    if (!sectionMap.has(s.user_word_id)) {
      sectionMap.set(s.user_word_id, []);
    }
    sectionMap.get(s.user_word_id).push({
      id: s.id,
      section_word: s.section_word,
      is_base_form: s.is_base_form,
      pos_groups: posGroupMap.get(s.id) || []
    });
  }

  // ---- Kelimelere dağıt ----
  for (const word of words) {
    word.sections = sectionMap.get(word.id) || [];
    
    // UI için kolay erişim: ilk section'ın pos_groups'ları
    if (word.sections.length > 0) {
      word.pos_groups = word.sections[0].pos_groups;
    } else {
      word.pos_groups = [];
    }

    // İlk çeviriyi hızlı erişim için ekle (opsiyonel)
    if (word.pos_groups.length > 0 && word.pos_groups[0].senses.length > 0) {
      const firstSense = word.pos_groups[0].senses[0];
      word.primary_translation = firstSense.translations[0] || '';
      word.primary_definition = firstSense.definition || '';
    }
  }
}

module.exports = { enrichWordsBatch };