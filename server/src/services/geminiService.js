/**
 * Gemini AI Generation Service
 * High-speed, resilient multi-model pipeline:
 * 1. gemini-flash-lite-latest (Primary: ultra-fast, high quota)
 * 2. gemini-3.5-flash-lite (Secondary fallback: fast, stable)
 * 3. gemini-3.8-flash (Tertiary fallback)
 * With in-flight deduplication and auto-failover on 429/502/503.
 */

const db = require('../db/schema');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest'
];

class GeminiService {
  constructor() {
    this.inFlightRequests = new Map();
    this.inFlightVocab = new Map();
  }

  /**
   * Generates a batch of fresh questions with in-flight deduplication
   */
  async generateQuestions(sectionId, level = 'B1', count = 5, customTopic = '') {
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
    const sectionRow = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId);
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
  "vocabularyPartOfSpeech": "noun, verb, adjective, or phrasal verb"
}

Pedagogical Quality Guidelines:
- Questions must be natural, authentic, and modern.
- Distractors must represent common learner mistakes.
- Explanations MUST be in Russian so learners immediately understand the nuance.
`;

    let lastError = null;

    // Try candidate models in order: gemini-flash-lite-latest -> gemini-3.5-flash-lite -> gemini-3.8-flash
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
          parsedQuestions = JSON.parse(rawText);
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

        // Insert into SQLite
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
          const info = insertStmt.run(
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
              const existingWord = db.prepare('SELECT id FROM dictionary WHERE LOWER(word) = LOWER(?)').get(wordClean);
              if (!existingWord) {
                db.prepare(`
                  INSERT INTO dictionary (
                    word, transcription, part_of_speech, translation, definition,
                    example_sentence, example_translation, level, section_id
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  wordClean,
                  q.vocabularyTranscription || '',
                  q.vocabularyPartOfSpeech || 'word',
                  q.vocabularyTranslation.trim(),
                  q.explanation || '',
                  q.contextText || q.questionText,
                  q.explanation || '',
                  level,
                  sectionId
                );
                console.log(`[Lazy DB Enrichment] Auto-saved new dictionary word: "${wordClean}"`);
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
  async generateVocabulary(level = 'B1', sectionId = 'general', count = 10) {
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

  async _executeVocabGeneration(level = 'B1', sectionId = 'general', count = 10) {
    let topicFocus = 'general everyday English vocabulary, real-life communication, common verbs and nouns';
    if (sectionId && sectionId !== 'general' && sectionId !== 'all') {
      const sectionRow = db.prepare('SELECT * FROM sections WHERE id = ?').get(sectionId);
      if (sectionRow) {
        topicFocus = `${sectionRow.title} (${sectionRow.prompt_focus})`;
      }
    }

    // Retrieve recent words already in the database for this level to avoid duplicates
    let existingWordsList = '';
    try {
      const existingRows = db.prepare('SELECT word FROM dictionary WHERE level = ? ORDER BY id DESC LIMIT 150').all(level);
      if (existingRows.length > 0) {
        existingWordsList = existingRows.map(r => r.word).join(', ');
      }
    } catch (_) {}

    const systemPrompt = `
You are an expert Cambridge/Oxford lexicographer and English tutor.
Generate ${count} essential, high-yield English vocabulary words or phrasal verbs for CEFR level ${level}.
Topic Category: "${topicFocus}".

Strict Output Requirements:
1. Return ONLY a valid JSON array of ${count} objects.
2. Each object MUST match this exact structure:
[
  {
    "word": "English word or phrasal verb",
    "transcription": "/IPA phonetics/",
    "partOfSpeech": "noun, verb, adjective, or phrasal verb",
    "translation": "Точный русский перевод (1-3 синонима)",
    "definition": "Clear concise English definition",
    "exampleSentence": "Authentic, modern example sentence in English",
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

        let parsed = JSON.parse(rawText);
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
          const existing = db.prepare('SELECT id FROM dictionary WHERE LOWER(word) = LOWER(?)').get(wordClean);
          if (existing) continue;

          const info = insertStmt.run(
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
}

module.exports = new GeminiService();

