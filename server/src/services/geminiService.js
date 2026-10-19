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
  'gemini-2.5-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash'
];

const CANDIDATE_MODELS = process.env.GEMINI_MODELS
  ? process.env.GEMINI_MODELS.split(',').map(m => m.trim()).filter(Boolean)
  : DEFAULT_MODELS;

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
          let cleaned = (rawText || '').trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
          }
          parsedQuestions = JSON.parse(cleaned);
          if (!Array.isArray(parsedQuestions) && typeof parsedQuestions === 'object') {
            if (Array.isArray(parsedQuestions.questions)) {
              parsedQuestions = parsedQuestions.questions;
            } else {
              parsedQuestions = [parsedQuestions];
            }
          }
        } catch (parseErr) {
          console.error(`Failed to parse JSON from ${model}:`, rawText);
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
    const DIVERSE_THEMES = [
      'home, kitchen, living space and everyday utensils',
      'city life, public places, shops, transport and directions',
      'food, groceries, drinks, cooking, meals and flavors',
      'hobbies, sports, leisure, creative arts and entertainment',
      'nature, weather, climate, landscapes, plants and animals',
      'clothing, footwear, accessories, fabrics and personal items',
      'human emotions, character traits, sensations and bodily feelings',
      'professions, workplace interactions, tools, routines and crafts',
      'travel, hotels, luggage, geography, vacation and sightseeing',
      'active daily verbs, expressive adjectives and practical collocations'
    ];
    const randomTheme = DIVERSE_THEMES[Math.floor(Math.random() * DIVERSE_THEMES.length)];

    let topicFocus = `Everyday communication (${randomTheme})`;
    if (sectionId && sectionId !== 'general' && sectionId !== 'all') {
      const sectionRow = await db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId);
      if (sectionRow) {
        topicFocus = `${sectionRow.title} (${sectionRow.prompt_focus})`;
      }
    }

    // Retrieve up to 300 recent and random words already in the database for this level to avoid duplicates
    let existingWordsList = '';
    try {
      const existingRows = await db.prepare('SELECT word FROM dictionary WHERE level = ? ORDER BY id DESC LIMIT 300').all(level);
      if (existingRows.length > 0) {
        existingWordsList = existingRows.map(r => r.word).join(', ');
      }
    } catch (_) {}

    const systemPrompt = `
You are an expert Cambridge/Oxford lexicographer and English tutor.
Generate ${count} essential, high-yield English vocabulary words, collocations, or phrasal verbs for CEFR level ${level}.
Topic Category & Subtheme: "${topicFocus}".

Strict Output Requirements:
1. Return ONLY a valid JSON array of ${count} objects.
2. Each object MUST match this exact structure:
[
  {
    "word": "English word or phrasal verb",
    "transcription": "/IPA phonetics/",
    "partOfSpeech": "noun, verb, adjective, or phrasal verb",
    "translation": "Точный русский перевод (1-3 синонима)",
    "definition": "Clear concise English definition of the target word itself (never explain test questions or grammar rules)",
    "exampleSentence": "Authentic, natural example sentence in English strictly containing the target word",
    "exampleTranslation": "Русский перевод примера",
    "ruleTip": "Полезный совет по употреблению, предлогу или типичной ошибке"
  }
]

${existingWordsList ? `IMPORTANT: Do NOT generate any of the following already known words: ${existingWordsList}. Generate fresh, different words!` : ''}
All translations and definitions must be precise, natural, and suited for ${level} students.
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
          let cleaned = rawText.trim();
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
          }
          parsed = JSON.parse(cleaned);
        } catch (pErr) {
          console.warn(`[Vocab Fallback] Failed to parse JSON from ${model}:`, pErr.message);
          continue;
        }

        if (!Array.isArray(parsed) && parsed.words) parsed = parsed.words;
        if (!Array.isArray(parsed)) parsed = [parsed];

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

module.exports = new GeminiService();
