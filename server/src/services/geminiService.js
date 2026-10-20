/**
 * Gemini AI Generation Service
 * High-speed, resilient multi-model pipeline:
 * 1. gemini-flash-lite-latest (Primary: ultra-fast, high free-tier quota & RPM)
 * 2. gemini-2.5-flash-lite (Direct pinned lightweight model)
 * 3. gemini-flash-latest (Secondary fallback: standard flash)
 * 4. gemini-2.5-flash (Tertiary fallback)
 * With in-flight deduplication and auto-failover on 429/502/503.
 * Models can also be overridden via process.env.GEMINI_MODELS.
 */

const db = require('../db/schema');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

const DEFAULT_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash'
];

const CANDIDATE_MODELS = process.env.GEMINI_MODELS
  ? process.env.GEMINI_MODELS.split(',').map(m => m.trim()).filter(Boolean)
  : DEFAULT_MODELS;

/**
 * Resilient JSON Array Parser & Recovery Engine
 * Handles markdown fences, unescaped internal quotes, newlines, and extracts
 * valid items individually if a single item contains syntax errors.
 */
function cleanAndParseJsonArray(rawText, expectedProperty = 'words') {
  if (!rawText || typeof rawText !== 'string') return [];

  let cleaned = rawText.trim();
  // Strip markdown code fences (```json or ```)
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  }

  // 1. Direct parse fast path
  try {
    const res = JSON.parse(cleaned);
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res[expectedProperty])) return res[expectedProperty];
    if (res && Array.isArray(res.words)) return res.words;
    if (res && Array.isArray(res.questions)) return res.questions;
    if (res && typeof res === 'object') return [res];
  } catch (_) {
    // Proceed to repair steps
  }

  // 2. Try array slicing between first '[' and last ']'
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const slice = cleaned.substring(firstBracket, lastBracket + 1);
    try {
      const res = JSON.parse(slice);
      if (Array.isArray(res)) return res;
    } catch (_) {
      // Proceed to object-by-object extraction
    }
  }

  // 3. Object-by-object extraction & recovery
  const recovered = [];
  const objRegex = /\{[\s\S]*?\}(?=\s*,\s*\{|\s*\])/g;
  let match;
  while ((match = objRegex.exec(cleaned)) !== null) {
    let block = match[0].trim();
    try {
      const obj = JSON.parse(block);
      recovered.push(obj);
    } catch (_) {
      try {
        const sanitized = block
          .replace(/[\r\n]+/g, ' ')
          .replace(/"translation"\s*:\s*"([\s\S]*?)"(?=\s*,\s*")/g, (m, val) => {
            return `"translation": "${val.replace(/"/g, "'")}"`;
          });
        const obj = JSON.parse(sanitized);
        recovered.push(obj);
      } catch (__) {
        // Skip malformed individual element
      }
    }
  }

  if (recovered.length > 0) {
    return recovered;
  }

  // 4. Fallback: try stripping unescaped newlines from entire array slice
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const flattened = cleaned
        .substring(firstBracket, lastBracket + 1)
        .replace(/[\r\n]+/g, ' ');
      const res = JSON.parse(flattened);
      if (Array.isArray(res)) return res;
    } catch (_) {}
  }

  throw new Error('Unable to parse JSON array from model output');
}

/**
 * Rich domain-specific micro-themes ensuring 100% fresh, non-duplicate vocabulary.
 */
const VOCABULARY_MICRO_THEMES = {
  general: [
    'astronomy, solar system, space exploration, planets and cosmic phenomena',
    'woodworking, carpentry, handmade crafts, workshop tools and repair materials',
    'culinary arts, food science, gastronomy, spices, baking and culinary techniques',
    'psychology, cognitive biases, mental wellness, personality traits and human behavior',
    'architecture, urban planning, historical monuments, bridges and building construction',
    'sports analytics, extreme athletics, athletic training, fitness and sports medicine',
    'ecology, marine biology, wildlife conservation, biodiversity and climate ecosystems',
    'photography, cinematography, visual arts, lenses, lighting and aesthetic composition',
    'gardening, botany, rare plants, horticulture, agriculture and greenhouse cultivation',
    'emotions, subtle feelings, human empathy, social relationships and character virtues',
    'music theory, acoustic instruments, orchestral performance, sound engineering and genres',
    'geology, volcanoes, minerals, oceanography, caverns and earth sciences',
    'navigation, cartography, desert exploration, maritime sailing and wilderness survival',
    'daily home appliances, furniture restoration, smart gadgets and interior decor',
    'clothing textiles, fashion history, tailoring, fabrics and personal accessories',
    'health, immune system, medicine, pharmacy, symptoms and wellness routines',
    'performing arts, theater, acting terminology, stage design and classical literature',
    'everyday street life, local markets, neighborhood communities and public services'
  ],
  conversational: [
    'informal slang, modern spoken idioms, conversational fillers and react phrases',
    'friendly banter, humor, teasing, casual greetings and warm farewells',
    'expressing surprise, skepticism, enthusiasm, empathy and disagreement in real speech',
    'making weekend plans, discussing opinions, storytelling transitions and spontaneous dialogue',
    'polite requests, apologies, conversational softeners and casual phone/chat expressions',
    'daily social interactions: coffee runs, grocery small talk, roommates and neighbors'
  ],
  ielts_toefl: [
    'academic essay transition phrases, argumentative markers and thesis qualifiers',
    'data trends, graph analysis, demographic shifts, statistical comparisons and forecasts',
    'environmental challenges, sustainability, renewable energy and urban expansion',
    'education systems, pedagogy, cognitive development, research methodology and literacy',
    'scientific progress, ethical dilemmas, technological disruption and sociological theory',
    'globalization, macroeconomics, international trade and cultural heritage preservation'
  ],
  phrasal_idioms: [
    'high-frequency multi-word verbs with take, get, put, come, go, turn, break, look',
    'idiomatic expressions for success, failure, hard work, deadlines and decision-making',
    'relationship phrasal verbs: falling out, making up, getting along, looking up to',
    'mind and memory idioms: off the top of one\'s head, bear in mind, ring a bell',
    'phrasal verbs for daily routines, health, travel, spending, saving and problem-solving'
  ],
  business: [
    'negotiations, deal-closing, contract stipulations, concessions and compromise',
    'venture capital, startup funding, ROI, equity, revenue models and fiscal quarterly reports',
    'corporate leadership, agile team management, performance KPIs and delegating tasks',
    'product launches, brand positioning, consumer acquisition and market saturation',
    'workplace ethics, compliance, intellectual property, corporate governance and supply chain'
  ],
  tech_it: [
    'cloud computing, microservices, containerization (Docker, Kubernetes) and CI/CD pipelines',
    'software engineering paradigms, refactoring, algorithms, latency, concurrency and caching',
    'cybersecurity, threat vectors, encryption, penetration testing and vulnerability management',
    'artificial intelligence, neural networks, machine learning pipelines and NLP models',
    'frontend architecture, reactivity, DOM rendering, UI/UX interactions and accessibility',
    'database management, SQL indexing, ACID transactions, data warehousing and ETL'
  ],
  travel: [
    'airports, boarding gates, passport control, excess baggage and flight delays',
    'hotel accommodation, concierge requests, room amenities and hospitality etiquette',
    'public transit in foreign cities, metro transfers, ticketing and asking for directions',
    'cultural tourism, museum etiquette, guided tours and landmark sightseeing',
    'outdoor hiking, camping gear, trail markers, eco-tourism and mountain expeditions',
    'travel emergencies, lost property, medical assistance abroad and currency exchange'
  ]
};

class GeminiService {
  constructor() {
    this.inFlightRequests = new Map();
    this.inFlightVocab = new Map();
  }

  /**
   * Generates a batch of fresh questions with in-flight deduplication
   */
  async generateQuestions(sectionId, level = 'B1', count = 10, customTopic = '') {
    const cacheKey = `${sectionId}_${level}_${customTopic}`;

    if (this.inFlightRequests.has(cacheKey)) {
      console.log(`[Deduplication] Awaiting in-flight generation for ${cacheKey}...`);
      return await this.inFlightRequests.get(cacheKey);
    }

    const taskPromise = this._executeGeneration(sectionId, level, count, customTopic);
    this.inFlightRequests.set(cacheKey, taskPromise);

    try {
      return await taskPromise;
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  async _executeGeneration(sectionId, level, count, customTopic) {
    const sectionRow = await db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId);
    const focus = sectionRow ? sectionRow.prompt_focus : 'General English and vocabulary';
    const sectionTitle = sectionRow ? sectionRow.title : sectionId;

    const systemPrompt = `
You are an expert Cambridge/Oxford certified English Language examiner and native pedagogical tutor.
Generate ${count} unique, engaging, and pedagogically sound English test questions.

Target Section: "${sectionTitle}"
Specialized Focus: ${focus}
Target CEFR Level: ${level}
${customTopic ? `Specific Topic/Context: "${customTopic}"` : ''}

Strict Output Requirements:
1. Return ONLY a valid JSON array of ${count} objects.
2. Each object in the array MUST have this exact structure:
{
  "questionText": "A clear question sentence with either a blank (________), a highlighted phrase to improve, or a contextual question.",
  "contextText": "A realistic 1-2 sentence real-life scenario, conversation dialogue, or contextual snippet illustrating where this occurs.",
  "options": [
    "Option A",
    "Option B",
    "Option C",
    "Option D"
  ],
  "correctIndex": 0,
  "explanation": "Clear, informative explanation in Russian explaining why this option is correct and why other options are incorrect or unnatural.",
  "grammarRule": "Concise summary of the underlying grammatical rule, idiom definition, or collocation principle in Russian.",
  "pronunciationTip": "Brief phonetics or pronunciation note (IPA or stress tip) in English/Russian.",
  "vocabularyWord": "The key target English word or collocation featured in this question",
  "vocabularyTranslation": "Precise Russian translation of the target word/collocation",
  "vocabularyTranscription": "IPA phonetic transcription, e.g. /dɪˈplɔɪ/",
  "vocabularyPartOfSpeech": "noun, verb, adjective, or phrasal verb",
  "vocabularyDefinition": "Concise natural English definition of the target word itself (NOT an explanation of the test question)",
  "vocabularyExampleSentence": "An authentic English example sentence containing the target word itself",
  "vocabularyExampleTranslation": "Russian translation of that example sentence"
}

Pedagogical Quality Guidelines:
- Questions must be natural, authentic, and modern.
- Distractors must represent common learner mistakes.
- Explanations MUST be in Russian so learners immediately understand the nuance.
`;

    let lastError = null;

    // Try candidate models in order: lite -> flash -> fallbacks
    for (const model of CANDIDATE_MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`[Model Dispatch] Requesting generation from ${model}...`);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: systemPrompt }]
              }
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
              topP: 0.95
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[Model Fallback] ${model} returned ${response.status}. Attempting next model...`);
          lastError = new Error(`Model ${model} returned ${response.status}: ${errorText}`);
          continue; // Try next model in chain
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
          console.warn(`[Model Fallback] ${model} returned empty candidates. Attempting next model...`);
          continue;
        }

        // Parse JSON array
        let parsedQuestions = [];
        try {
          parsedQuestions = cleanAndParseJsonArray(rawText, 'questions');
        } catch (parseErr) {
          console.error(`Failed to parse JSON from ${model}:`, parseErr.message);
          continue;
        }

        // Insert into database
        const insertStmt = db.prepare(`
          INSERT INTO questions (
            section_id, level, question_text, context_text, options_json,
            correct_index, explanation, grammar_rule, pronunciation_tip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const savedQuestions = [];

        for (const q of parsedQuestions) {
          if (!q.questionText || !Array.isArray(q.options) || q.options.length < 2) continue;

          const correctIdx = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
          const info = await insertStmt.run(
            sectionId,
            level,
            q.questionText,
            q.contextText || '',
            JSON.stringify(q.options),
            correctIdx,
            q.explanation || 'Правильный ответ подтвержден правилом.',
            q.grammarRule || '',
            q.pronunciationTip || ''
          );

          // Lazy Database Enrichment:
          // Automatically save newly encountered vocabulary words into the dictionary table!
          if (q.vocabularyWord && q.vocabularyTranslation) {
            try {
              const wordClean = q.vocabularyWord.trim();
              const existingWord = await db.prepare('SELECT id FROM dictionary WHERE LOWER(word) = LOWER(?)').get(wordClean);
              if (!existingWord) {
                // Ensure definition is a true lexical definition, never a test explanation or grammar answer
                const rawDef = q.vocabularyDefinition || '';
                const isBadDef = /правильный ответ|союз|конструкция|используется с|применяется|вариант/i.test(rawDef);
                const cleanDef = (!isBadDef && rawDef.trim()) 
                  ? rawDef.trim() 
                  : `Key English vocabulary term: ${wordClean}`;

                // Ensure example sentence contains the target word
                let cleanSentence = (q.vocabularyExampleSentence || '').trim();
                const wordRoot = wordClean.toLowerCase().split(' ')[0].replace(/[^a-z]/g, '');
                if (!cleanSentence || !cleanSentence.toLowerCase().includes(wordRoot)) {
                  cleanSentence = `You should learn how to use "${wordClean}" in daily English.`;
                }

                // Ensure translation is clean
                let cleanExampleTr = (q.vocabularyExampleTranslation || '').trim();
                if (!cleanExampleTr || /правильный ответ|союз|конструкция|вариант/i.test(cleanExampleTr)) {
                  cleanExampleTr = `Вам стоит научиться использовать «${wordClean}» в повседневном английском.`;
                }

                await db.prepare(`
                  INSERT INTO dictionary (
                    word, transcription, part_of_speech, translation, definition,
                    example_sentence, example_translation, level, section_id
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  wordClean,
                  q.vocabularyTranscription || '',
                  q.vocabularyPartOfSpeech || 'word',
                  q.vocabularyTranslation.trim(),
                  cleanDef,
                  cleanSentence,
                  cleanExampleTr,
                  level,
                  sectionId
                );
                console.log(`[Lazy DB Enrichment] Auto-saved new verified dictionary word: "${wordClean}"`);
              }
            } catch (vocabErr) {
              // Ignore duplicate or schema constraint silently
            }
          }

          savedQuestions.push({
            id: Number(info.lastInsertRowid),
            section_id: sectionId,
            level,
            question_text: q.questionText,
            context_text: q.contextText || '',
            options: q.options,
            correct_index: correctIdx,
            explanation: q.explanation || '',
            grammar_rule: q.grammarRule || '',
            pronunciation_tip: q.pronunciationTip || ''
          });
        }

        console.log(`[Model Success] Generated ${savedQuestions.length} questions using ${model}.`);
        return savedQuestions;
      } catch (err) {
        console.warn(`[Model Exception] Error with ${model}:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('All model fallbacks failed');
  }

  /**
   * Generates a batch of rich vocabulary words for the dictionary on demand
   * with in-flight deduplication and duplicate-prevention
   */
  async generateVocabulary(level = 'B1', sectionId = 'general', count = 50) {
    const cacheKey = `vocab_${level}_${sectionId}`;

    if (this.inFlightVocab.has(cacheKey)) {
      console.log(`[Vocab Deduplication] Awaiting in-flight vocabulary generation for ${cacheKey}...`);
      return await this.inFlightVocab.get(cacheKey);
    }

    const taskPromise = this._executeVocabGeneration(level, sectionId, count);
    this.inFlightVocab.set(cacheKey, taskPromise);

    try {
      return await taskPromise;
    } finally {
      this.inFlightVocab.delete(cacheKey);
    }
  }

  async _executeVocabGeneration(level = 'B1', sectionId = 'general', count = 50) {
    const sectionThemes = VOCABULARY_MICRO_THEMES[sectionId] || VOCABULARY_MICRO_THEMES.general;
    const randomTheme = sectionThemes[Math.floor(Math.random() * sectionThemes.length)];
    const topicFocus = `${sectionId} (${randomTheme})`;

    // Retrieve up to 200 random existing words for this level and section to avoid duplicates
    let existingWordsList = '';
    try {
      const existingRows = await db.prepare(
        'SELECT word FROM dictionary WHERE level = ? AND section_id = ? ORDER BY RANDOM() LIMIT 200'
      ).all(level, sectionId);
      if (existingRows.length > 0) {
        existingWordsList = existingRows.map(r => r.word).join(', ');
      }
    } catch (_) {}

    const systemPrompt = `
You are an expert Cambridge/Oxford lexicographer and English tutor.
Generate ${count} essential, high-yield English vocabulary words, collocations, or phrasal verbs for CEFR level ${level}.
Section: "${sectionId}".
Thematic Micro-Focus: "${randomTheme}".

CRITICAL ANTI-DUPLICATION & QUALITY RULES:
1. Do NOT generate generic starter words (e.g. apple, book, cat, dog, table, car, boy, girl, house, water, go, see). Focus on rich, vibrant, authentic vocabulary specific to the micro-theme "${randomTheme}" appropriate for ${level} learners.
${existingWordsList ? `2. The following words are ALREADY in our database — DO NOT duplicate any of them: ${existingWordsList}.` : ''}
3. Return ONLY a valid JSON array of ${count} objects with no markdown fences, no conversational text.
4. Each object must have:
   - "word": English word, collocation or phrasal verb
   - "transcription": "/IPA phonetics/"
   - "partOfSpeech": "noun", "verb", "adjective", "adverb" or "phrasal verb"
   - "translation": accurate Russian translation (1-3 synonyms, use single quotes inside if quotes are needed)
   - "definition": clear, concise English definition of the target word itself
   - "exampleSentence": authentic English example sentence containing the target word
   - "exampleTranslation": Russian translation of the example sentence
   - "ruleTip": brief tip on usage, prepositions, or collocations
`;

    let lastError = null;

    for (const model of CANDIDATE_MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`[Vocab Dispatch] Requesting vocabulary generation from ${model} (level: ${level}, topic: ${sectionId})...`);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[Vocab Fallback] ${model} returned ${response.status}: ${errText}`);
          continue;
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        let parsed = [];
        try {
          parsed = cleanAndParseJsonArray(rawText, 'words');
        } catch (pErr) {
          console.warn(`[Vocab Fallback] Failed to parse JSON from ${model}:`, pErr.message);
          continue;
        }

        const savedWords = [];
        const insertStmt = db.prepare(`
          INSERT INTO dictionary (
            word, transcription, part_of_speech, translation, definition,
            example_sentence, example_translation, level, section_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of parsed) {
          if (!item.word || !item.translation) continue;
          const wordClean = item.word.trim();
          const existing = await db.prepare('SELECT id FROM dictionary WHERE LOWER(word) = LOWER(?)').get(wordClean);
          if (existing) continue;

          const info = await insertStmt.run(
            wordClean,
            item.transcription || '',
            item.partOfSpeech || 'word',
            item.translation.trim(),
            item.definition || '',
            item.exampleSentence || '',
            item.exampleTranslation || '',
            level,
            sectionId
          );

          savedWords.push({
            id: Number(info.lastInsertRowid),
            word: wordClean,
            transcription: item.transcription,
            part_of_speech: item.partOfSpeech,
            translation: item.translation,
            definition: item.definition,
            example_sentence: item.exampleSentence,
            example_translation: item.exampleTranslation,
            level,
            section_id: sectionId
          });
        }

        console.log(`[Vocab Success] Generated and saved ${savedWords.length} new words (level ${level}, section ${sectionId}).`);
        return savedWords;
      } catch (err) {
        console.warn(`[Vocab Exception] Error with ${model}:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error('Failed to generate vocabulary');
  }

  /**
   * Looks up a specific word (English or Russian).
   * Checks database first. If not found, requests Gemini to construct
   * a comprehensive dictionary card, persists it into SQLite, and returns it.
   */
  async lookupAndDefineWord(searchTerm) {
    if (!searchTerm || typeof searchTerm !== 'string') {
      throw new Error('Search term is required');
    }
    const cleanTerm = searchTerm.trim();
    if (cleanTerm.length === 0) {
      throw new Error('Search term cannot be empty');
    }

    // 1. Check if word already exists in dictionary
    const existing = await db.prepare(`
      SELECT * FROM dictionary 
      WHERE LOWER(word) = LOWER(?) OR LOWER(translation) = LOWER(?)
      ORDER BY id DESC
      LIMIT 1
    `).get(cleanTerm, cleanTerm);

    if (existing) {
      return {
        item: existing,
        isNew: false
      };
    }

    // 2. Query Gemini to generate full lexicographical card
    const systemPrompt = `
You are an expert Oxford/Cambridge lexicographer.
The user wants to look up the word or phrase: "${cleanTerm}".

Requirements:
1. If the input is in Russian (e.g. "курица"), translate it to the most common, authentic English word/phrase (e.g. "chicken").
2. If the input is in English (e.g. "chicken"), provide its exact dictionary details.
3. Return ONLY a valid JSON object matching this exact structure:
{
  "word": "English word in lower case (or appropriate casing)",
  "transcription": "/IPA phonetics/",
  "partOfSpeech": "noun, verb, adjective, adverb, or phrasal verb",
  "translation": "Точный русский перевод (1-3 основных значения через запятую)",
  "definition": "Clear concise English definition in simple English",
  "exampleSentence": "Natural, modern everyday example sentence using this word",
  "exampleTranslation": "Русский перевод примера",
  "level": "A1, A2, B1, B2, or C1 (appropriate CEFR level for this word)",
  "sectionId": "general (or tech_it, business, travel, conversational if strongly themed)"
}
`;

    let lastError = null;

    for (const model of CANDIDATE_MODELS) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`[Word Lookup Dispatch] Looking up "${cleanTerm}" with ${model}...`);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3
            }
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.warn(`[Word Lookup Fallback] ${model} returned ${response.status}: ${errText}`);
          continue;
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) continue;

        let parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) parsed = parsed[0];
        if (!parsed.word || !parsed.translation) continue;

        const targetWord = parsed.word.trim();

        // Check if word was inserted concurrently
        const doubleCheck = await db.prepare('SELECT * FROM dictionary WHERE LOWER(word) = LOWER(?)').get(targetWord);
        if (doubleCheck) {
          return { item: doubleCheck, isNew: false };
        }

        const insertStmt = db.prepare(`
          INSERT INTO dictionary (
            word, transcription, part_of_speech, translation, definition,
            example_sentence, example_translation, level, section_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const info = await insertStmt.run(
          targetWord,
          parsed.transcription || '',
          parsed.partOfSpeech || 'noun',
          parsed.translation.trim(),
          parsed.definition || '',
          parsed.exampleSentence || '',
          parsed.exampleTranslation || '',
          parsed.level || 'B1',
          parsed.sectionId || 'general'
        );

        const newRow = await db.prepare('SELECT * FROM dictionary WHERE id = ?').get(info.lastInsertRowid);
        console.log(`[Word Lookup Success] Added "${targetWord}" (id ${newRow.id}) to dictionary!`);

        return {
          item: newRow,
          isNew: true
        };
      } catch (err) {
        console.warn(`[Word Lookup Exception] with ${model}:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error(`Failed to lookup word: ${cleanTerm}`);
  }
}

const serviceInstance = new GeminiService();
serviceInstance.cleanAndParseJsonArray = cleanAndParseJsonArray;
serviceInstance.VOCABULARY_MICRO_THEMES = VOCABULARY_MICRO_THEMES;
serviceInstance.DEFAULT_MODELS = DEFAULT_MODELS;
module.exports = serviceInstance;
