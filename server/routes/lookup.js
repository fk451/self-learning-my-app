const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const puppeteer = require('puppeteer');

// ─── Puppeteer browser instance (tekil) ───
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    console.log('[LOOKUP] Puppeteer başlatılıyor...');
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });
    console.log('[LOOKUP] ✅ Puppeteer hazır');
  }
  return browserInstance;
}

// Uygulama kapanırken browser'ı kapat
process.on('SIGINT', async () => {
  if (browserInstance) await browserInstance.close();
  process.exit();
});
process.on('SIGTERM', async () => {
  if (browserInstance) await browserInstance.close();
  process.exit();
});

router.use((req, res, next) => {
  console.log(`[LOOKUP] ${req.method} ${req.path}`);
  next();
});

// ─── Reverso'dan kelime ara ───
router.get('/search/:word', auth, async (req, res) => {
  const word = req.params.word.toLowerCase().trim();
  console.log(`[LOOKUP] Aranan kelime: "${word}"`);

  let page = null;

  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Gerçek tarayıcı gibi davran
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    const urlWord = word.replace(/\s+/g, '+');
    const url = `https://dictionary.reverso.net/english-definition/${urlWord}#translation=turkish`;
    console.log(`[LOOKUP] Reverso URL: ${url}`);

    // Sayfaya git — Cloudflare challenge'ı otomatik çözülür
    const response = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log(`[LOOKUP] Sayfa yüklendi: ${response.status()}`);

    // Cloudflare challenge varsa biraz bekle
    const content = await page.content();
    if (content.includes('challenge-platform') || content.includes('Just a moment')) {
      console.log('[LOOKUP] Cloudflare challenge tespit edildi, bekleniyor...');
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 3000));
    }

    // İçerik yüklenene kadar bekle
    await page.waitForSelector('.definition-list__item, .result-title__title, .definition-pos-block', {
      timeout: 10000
    }).catch(() => {
      console.log('[LOOKUP] Selector bulunamadı, mevcut HTML ile devam ediliyor');
    });

    const html = await page.content();
    console.log(`[LOOKUP] HTML uzunluk: ${html.length}`);

    // Parse
    const data = parseReverso(html, word);
    console.log(`[LOOKUP] Parse sonuç: ${data.wordSections.length} bölüm`);

    if (data.wordSections.length === 0) {
      return res.status(404).json({
        error: `"${word}" kelimesi Reverso'da bulunamadı.`
      });
    }

    res.json({
      success: true,
      data: formatResult(data)
    });

  } catch (err) {
    console.error('[LOOKUP] Hata:', err.message);

    // Puppeteer hatası durumunda Free Dictionary'ye fallback
    console.log('[LOOKUP] Fallback: Free Dictionary API deneniyor...');
    try {
      const fallbackResult = await fallbackFreeDictionary(word);
      if (fallbackResult) {
        return res.json({ success: true, data: fallbackResult, source: 'freedictionary' });
      }
    } catch (e) { /* sessiz */ }

    res.status(500).json({ error: 'Arama sırasında hata oluştu: ' + err.message });
  } finally {
    if (page) {
      try { await page.close(); } catch (e) { /* sessiz */ }
    }
  }
});

// ══════════════════════════════════════════════════════════════
// FALLBACK: Free Dictionary API
// ══════════════════════════════════════════════════════════════
async function fallbackFreeDictionary(word) {
  const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!resp.ok) return null;

  const entries = await resp.json();
  if (!Array.isArray(entries)) return null;

  // Çeviriler
  let translations = [];
  try {
    const trResp = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|tr`);
    if (trResp.ok) {
      const trData = await trResp.json();
      if (trData.responseData?.translatedText) {
        const main = trData.responseData.translatedText.trim();
        if (main.toLowerCase() !== word.toLowerCase()) translations.push(main);
      }
      if (trData.matches) {
        for (const m of trData.matches) {
          if (m.translation && parseInt(m.quality || 0) > 50) {
            const t = m.translation.trim();
            if (t.toLowerCase() !== word && !translations.includes(t) && t.length < 100) {
              translations.push(t);
            }
          }
        }
      }
      translations = [...new Set(translations)].slice(0, 8);
    }
  } catch (e) { /* sessiz */ }

  const result = {
    word,
    phonetic: '',
    source_url: `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`,
    sections: [],
    sentence_examples: []
  };

  for (const entry of entries) {
    if (!result.phonetic) {
      result.phonetic = entry.phonetic || '';
      if (!result.phonetic && entry.phonetics) {
        for (const p of entry.phonetics) { if (p.text) { result.phonetic = p.text; break; } }
      }
    }

    const section = {
      section_word: entry.word || word,
      is_base_form: (entry.word || '').toLowerCase() !== word.toLowerCase(),
      pos_groups: []
    };

    for (const meaning of (entry.meanings || [])) {
      const pg = { pos: meaning.partOfSpeech || '', senses: [] };

      for (const def of (meaning.definitions || [])) {
        const sense = {
          definition: def.definition || '',
          frequency: null, dialect: null, has_exclamation: false,
          mention_text: null, mention_sentence: null,
          examples: def.example ? [def.example] : [],
          translations: pg.senses.length === 0 ? [...translations] : []
        };
        if (sense.definition) pg.senses.push(sense);
      }

      if (meaning.synonyms?.length && pg.senses.length > 0) {
        pg.senses[0].mention_text = 'Synonyms: ' + meaning.synonyms.slice(0, 5).join(', ');
      }
      if (meaning.antonyms?.length && pg.senses.length > 0) {
        pg.senses[0].mention_sentence = 'Antonyms: ' + meaning.antonyms.slice(0, 5).join(', ');
      }

      if (pg.senses.length > 0) section.pos_groups.push(pg);
    }

    if (section.pos_groups.length > 0) result.sections.push(section);
  }

  return result;
}

// ══════════════════════════════════════════════════════════════
// SONUÇ FORMATLAMA
// ══════════════════════════════════════════════════════════════
function formatResult(data) {
  return {
    word: data.searchedWord,
    phonetic: data.phonetic,
    source_url: data.url,
    sections: data.wordSections.map(sec => ({
      section_word: sec.word,
      is_base_form: sec.isBaseForm,
      pos_groups: sec.posGroups.map(g => ({
        pos: g.pos,
        senses: g.senses.map(s => ({
          definition: s.definition,
          frequency: s.frequency || null,
          dialect: s.dialect || null,
          has_exclamation: s.hasExclamation || false,
          mention_text: s.mentionText || null,
          mention_sentence: s.mentionSentence || null,
          examples: s.examples || [],
          translations: s.translations || []
        }))
      }))
    })),
    sentence_examples: data.sentenceExamples || []
  };
}

// ══════════════════════════════════════════════════════════════
// REVERSO PARSER — background.js'den birebir
// ══════════════════════════════════════════════════════════════

function parseReverso(html, searchedWord) {
  const result = {
    searchedWord,
    phonetic: '',
    wordSections: [],
    sentenceExamples: [],
    url: `https://dictionary.reverso.net/english-definition/${searchedWord.replace(/\s+/g, '+')}#translation=turkish`
  };

  try {
    const im = html.match(/class="ipa__default"[^>]*>([^<]+)/i);
    if (im) result.phonetic = strip(im[1]);

    const itemStarts = findAll(html, /<div[^>]*class="[^"]*definition-list__item\b[^"]*"[^>]*>/gi);

    if (itemStarts.length > 0) {
      for (let i = 0; i < itemStarts.length; i++) {
        const start = itemStarts[i];
        const end = itemStarts[i + 1] || html.length;
        const sectionHTML = html.substring(start, end);
        const section = parseWordSection(sectionHTML, searchedWord);
        if (section && section.posGroups.length > 0) {
          result.wordSections.push(section);
        }
      }
    }

    if (result.wordSections.length === 0) {
      const fallbackSection = parseWordSection(html, searchedWord);
      if (fallbackSection && fallbackSection.posGroups.length > 0) {
        result.wordSections.push(fallbackSection);
      }
    }

    const sentSection = html.match(
      /class="[^"]*examples-in-sentence-list__container[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*definition-list__|<footer|$)/i
    );
    if (sentSection) {
      sentSection[1].split(/<\/(?:div|li|p)>/i).forEach(line => {
        const t = strip(line);
        if (t.length > 10 && t.length < 500 && !isNavText(t)) {
          result.sentenceExamples.push(t);
        }
      });
      result.sentenceExamples = [...new Set(result.sentenceExamples)].slice(0, 10);
    }
  } catch (e) {
    console.error('[Reverso] Parse error:', e);
  }

  return result;
}

function parseWordSection(sectionHTML, searchedWord) {
  const section = { word: '', isBaseForm: false, posGroups: [] };

  const wordMatch = sectionHTML.match(/class="[^"]*definition-list__(?:blue-)?word[^"]*"[^>]*>([^<]+)/i);
  if (wordMatch) section.word = strip(wordMatch[1]).toLowerCase();

  if (!section.word) {
    const titleMatch = sectionHTML.match(/class="[^"]*result-title__title[^"]*"[^>]*>([^<]+)/i);
    if (titleMatch) section.word = strip(titleMatch[1]).toLowerCase();
  }

  if (!section.word) section.word = searchedWord;

  section.isBaseForm = section.word.toLowerCase().trim() !== searchedWord.toLowerCase().trim();

  const posBlockStarts = findAll(sectionHTML, /<div[^>]*class="[^"]*definition-pos-block"[^>]*>/gi);

  if (posBlockStarts.length > 0) {
    for (let i = 0; i < posBlockStarts.length; i++) {
      const start = posBlockStarts[i];
      const end = posBlockStarts[i + 1] || sectionHTML.length;
      const block = sectionHTML.substring(start, end);
      const posName = extractPosName(block);
      const group = { pos: posName, senses: [] };

      const exStarts = findAll(block, /<(?:div|app-definition-example)[^>]*class="[^"]*definition-example"[^>]*>/gi);
      for (let j = 0; j < exStarts.length; j++) {
        const es = exStarts[j];
        const ee = exStarts[j + 1] || block.length;
        const sense = parseSenseBlock(block.substring(es, ee));
        if (sense) group.senses.push(sense);
      }

      if (group.senses.length > 0) {
        const existing = section.posGroups.find(g => g.pos === posName);
        if (existing) existing.senses.push(...group.senses);
        else section.posGroups.push(group);
      }
    }
  }

  if (section.posGroups.length === 0) {
    const fallbackGroup = { pos: '', senses: [] };
    const exStarts = findAll(sectionHTML, /<(?:div|app-definition-example)[^>]*class="[^"]*definition-example"[^>]*>/gi);
    for (let j = 0; j < exStarts.length; j++) {
      const es = exStarts[j];
      const ee = exStarts[j + 1] || Math.min(es + 5000, sectionHTML.length);
      const sense = parseSenseBlock(sectionHTML.substring(es, ee));
      if (sense) fallbackGroup.senses.push(sense);
    }
    if (fallbackGroup.senses.length > 0) section.posGroups.push(fallbackGroup);
  }

  for (const g of section.posGroups) {
    const seen = new Set();
    g.senses = g.senses.filter(s => {
      const k = s.definition.toLowerCase().substring(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
  section.posGroups = section.posGroups.filter(g => g.senses.length > 0);

  return section;
}

function extractPosName(block) {
  const textMatch = block.match(/class="[^"]*definition-pos-block__pos[^"]*"[^>]*>([^<]+)/i);
  if (textMatch) {
    const t = strip(textMatch[1]).trim();
    if (t.length > 0 && t.length < 40) return t;
  }
  const allClasses = block.match(/definition-pos-block__pos_([A-Za-z]+)/g) || [];
  for (const cls of allClasses) {
    const name = cls.replace('definition-pos-block__pos_', '');
    if (!['uncolored', 'colored'].includes(name.toLowerCase()) && name.length > 1) return name;
  }
  return '';
}

function parseSenseBlock(block) {
  const sense = {
    definition: '', frequency: '', dialect: '', hasExclamation: false,
    mentionText: '', mentionSentence: '', examples: [], translations: []
  };

  const msDef = block.match(
    /class="[^"]*definition-example__mention-sentence[^"]*"[^>]*>([\s\S]*?)(?:<\/span>|<app-|<button)/i
  );
  if (msDef) sense.definition = strip(msDef[1]);

  if (!sense.definition || sense.definition.length < 2) {
    const defMatch = block.match(
      /class="[^"]*definition-example__def[^"]*"[^>]*>([\s\S]*?)(?:<\/div>)/i
    );
    if (defMatch) {
      const innerMs = defMatch[1].match(
        /class="[^"]*definition-example__mention-sentence[^"]*"[^>]*>([\s\S]*?)(?:<\/span>|<app-|<button)/i
      );
      sense.definition = strip(innerMs ? innerMs[1] : defMatch[1]);
    }
  }
  if (!sense.definition || sense.definition.length < 2) return null;

  const freqMatch = block.match(/definition-example__def_([\w-]+)/i);
  if (freqMatch) {
    const f = freqMatch[1].replace(/-/g, ' ').trim();
    if (f.length > 2 && f !== 'def') sense.frequency = f;
  }

  sense.hasExclamation = /class="[^"]*exclamation-mark/.test(block);

  const badges = new Set();
  const badgeRegex = /class="[^"]*\bbadge\b[^"]*"[^>]*>([^<]+)/gi;
  let bm;
  while ((bm = badgeRegex.exec(block)) !== null) {
    const t = strip(bm[1]);
    if (t.length > 0 && t.length < 30) badges.add(t);
  }
  const dialectRegex = /class="[^"]*definition-example__dialect[^"]*"[^>]*>([^<]+)/gi;
  let ddm;
  while ((ddm = dialectRegex.exec(block)) !== null) {
    const t = strip(ddm[1]);
    if (t.length > 0 && t.length < 30) badges.add(t);
  }
  const allBadges = [...badges];
  if (allBadges.some(b => /informal|slang|vulgar|taboo|offensive/i.test(b))) sense.hasExclamation = true;
  sense.dialect = allBadges.filter(b => !/informal|slang|vulgar|taboo|offensive/i.test(b)).join(', ');

  const mtMatch = block.match(
    /class="[^"]*definition-example__mention-text[^"]*"[^>]*>([\s\S]*?)(?:<\/i>|<\/span>|<\/div>|<app-)/i
  );
  if (mtMatch) sense.mentionText = strip(mtMatch[1]);
  if (msDef) sense.mentionSentence = strip(msDef[1]);

  const exRegex = /class="[^"]*definition-example__example-text-block[^"]*"[^>]*>([\s\S]*?)(?:<button|<\/li>|<\/div>)/gi;
  let em;
  while ((em = exRegex.exec(block)) !== null) {
    const t = strip(em[1]);
    if (t.length > 3) sense.examples.push(t);
  }
  if (sense.examples.length === 0) {
    const exAlt = /class="[^"]*definition-example__example[^"]*"[^>]*>([\s\S]*?)(?:<\/ul>|<\/div>)/gi;
    let ea;
    while ((ea = exAlt.exec(block)) !== null) {
      const t = strip(ea[1]);
      if (t.length > 3) sense.examples.push(t);
    }
  }

  const appChipRegex = /<app-translation-chip[^>]*class="[^"]*translation-chip[^"]*"[^>]*>([\s\S]*?)<\/app-translation-chip>/gi;
  let acm;
  while ((acm = appChipRegex.exec(block)) !== null) {
    const t = strip(acm[1]);
    if (t.length > 0 && t.length < 60) sense.translations.push(t);
  }
  if (sense.translations.length === 0) {
    const chipOpenRegex = /<(?:a|span|div|app-translation-chip)[^>]*class="[^"]*translation-chip[^"]*"[^>]*>/gi;
    const chipPositions = [];
    let cpm;
    while ((cpm = chipOpenRegex.exec(block)) !== null) {
      chipPositions.push(cpm.index + cpm[0].length);
    }
    for (const pos of chipPositions) {
      const after = block.substring(pos);
      const textMatch = after.match(/^([^<]*)/);
      if (textMatch) {
        const t = textMatch[1].trim();
        if (t.length > 0 && t.length < 60) sense.translations.push(t);
      }
    }
  }
  sense.translations = [...new Set(sense.translations)];

  return sense;
}

function findAll(html, regex) {
  const p = []; let m;
  while ((m = regex.exec(html)) !== null) p.push(m.index);
  return p;
}

function isNavText(t) {
  const nav = ['home','login','sign up','register','contact','about','privacy','terms','cookie','download','copyright','©','all rights','reverso'];
  const l = t.toLowerCase();
  return nav.some(w => l === w || (l.length < 30 && l.includes(w)));
}

function strip(str) {
  return str.replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'").replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D').replace(/&ldquo;/g, '\u201C')
    .replace(/&mdash;/g, '\u2014').replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026').replace(/\s+/g, ' ').trim();
}

module.exports = router;