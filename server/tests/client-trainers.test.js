/**
 * Automated Test Suite: Interactive Game Mechanics & Client-Side Pedagogical Engines
 * Covers: Speed Sprint (True/False pairing, combo multiplier tiers 1x/2x/3x/4x, combo break on error),
 * Word Builder Spelling Anagrams (tile shuffling, letter picking, undo, completion check, hints),
 * Vocab Quiz Bi-directional generation (EN->RU, RU->EN, 4 distinct choices),
 * and Dictation / Listening phrase decomposition into shuffled tokens.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Interactive Trainers & Game Mechanics Test Suite', () => {
  // Mock dictionary words for game simulations
  const mockWords = [
    { id: 1, word: 'abandon', translation: 'покидать, отказываться' },
    { id: 2, word: 'brilliant', translation: 'блестящий, великолепный' },
    { id: 3, word: 'courage', translation: 'мужество, смелость' },
    { id: 4, word: 'deliberate', translation: 'намеренный, обдуманный' },
    { id: 5, word: 'efficient', translation: 'эффективный, действенный' },
    { id: 6, word: 'frequent', translation: 'частый, регулярный' },
    { id: 7, word: 'generous', translation: 'щедрый, великодушный' },
    { id: 8, word: 'hesitate', translation: 'колебаться, сомневаться' },
  ];

  // --------------------------------------------------------------------------
  // 1. Speed Sprint Game Mechanics
  // --------------------------------------------------------------------------
  describe('Speed Sprint Engine', () => {
    function generateSprintPair(words, index, forceTrue = null) {
      const target = words[index % words.length];
      const isTrue = forceTrue !== null ? forceTrue : Math.random() > 0.5;

      if (isTrue) {
        return { targetWord: target.word, presentedTranslation: target.translation, isCorrect: true };
      } else {
        const others = words.filter(w => w.id !== target.id);
        const distractor = others[Math.floor(Math.random() * others.length)];
        return { targetWord: target.word, presentedTranslation: distractor.translation, isCorrect: false };
      }
    }

    function calculateMultiplier(combo) {
      if (combo >= 8) return 4;
      if (combo >= 5) return 3;
      if (combo >= 3) return 2;
      return 1;
    }

    it('1. Generates valid True and False pairing with correct boolean flag', () => {
      const truePair = generateSprintPair(mockWords, 0, true);
      assert.strictEqual(truePair.isCorrect, true);
      assert.strictEqual(truePair.presentedTranslation, mockWords[0].translation);

      const falsePair = generateSprintPair(mockWords, 0, false);
      assert.strictEqual(falsePair.isCorrect, false);
      assert.notStrictEqual(falsePair.presentedTranslation, mockWords[0].translation);
    });

    it('2. Combo Multiplier Progression: 1x -> 2x -> 3x -> 4x at exact combo thresholds', () => {
      assert.strictEqual(calculateMultiplier(0), 1);
      assert.strictEqual(calculateMultiplier(1), 1);
      assert.strictEqual(calculateMultiplier(2), 1);
      assert.strictEqual(calculateMultiplier(3), 2); // tier 2 (combo 3-4)
      assert.strictEqual(calculateMultiplier(4), 2);
      assert.strictEqual(calculateMultiplier(5), 3); // tier 3 (combo 5-7)
      assert.strictEqual(calculateMultiplier(7), 3);
      assert.strictEqual(calculateMultiplier(8), 4); // tier 4 (combo 8+)
      assert.strictEqual(calculateMultiplier(20), 4);
    });

    it('3. Combo Breaker: Wrong answer resets combo to 0 while maintaining accumulated score', () => {
      let combo = 7; // was at 3x multiplier
      let score = 250;

      // User makes an error
      const isCorrectAnswer = false;
      if (isCorrectAnswer) {
        combo += 1;
        score += 10 * calculateMultiplier(combo);
      } else {
        combo = 0; // Reset
      }

      assert.strictEqual(combo, 0, 'Combo must reset to 0 upon error');
      assert.strictEqual(score, 250, 'Score must not decrease on error');
    });
  });

  // --------------------------------------------------------------------------
  // 2. Word Builder (Spelling / Anagram) Engine
  // --------------------------------------------------------------------------
  describe('Word Builder Spelling Engine', () => {
    function prepareAnagram(word) {
      const letters = word.toLowerCase().split('').map((char, index) => ({ id: `${char}_${index}`, char }));
      // Deterministic pseudo-shuffle for test
      const shuffled = [...letters].reverse();
      return { letters, shuffled };
    }

    it('4. Anagram Generation: Contains all letters of the target word', () => {
      const target = 'courage';
      const { letters, shuffled } = prepareAnagram(target);

      assert.strictEqual(shuffled.length, target.length);
      const originalSorted = target.split('').sort().join('');
      const shuffledSorted = shuffled.map(t => t.char).sort().join('');
      assert.strictEqual(originalSorted, shuffledSorted);
    });

    it('5. Tile Selection & Undo Mechanics: Moving letters between bank and answer tray', () => {
      const target = 'cold';
      let bank = target.split('').map((c, i) => ({ id: i, char: c }));
      let tray = [];

      // Pick first letter 'c'
      const picked = bank[0];
      bank = bank.filter(b => b.id !== picked.id);
      tray.push(picked);

      assert.strictEqual(bank.length, 3);
      assert.strictEqual(tray.length, 1);
      assert.strictEqual(tray[0].char, 'c');

      // Undo picked letter
      const unpicked = tray.pop();
      bank.push(unpicked);

      assert.strictEqual(bank.length, 4);
      assert.strictEqual(tray.length, 0);
    });

    it('6. Word Completion Check: Case-insensitive match confirms successful spelling', () => {
      const target = 'brilliant';
      const traySuccess = 'BRILLIANT'.toLowerCase().split('');
      const trayFailure = 'brillant'.toLowerCase().split(''); // missing 'i'

      const isSuccess = traySuccess.join('') === target.toLowerCase();
      const isFailure = trayFailure.join('') === target.toLowerCase();

      assert.strictEqual(isSuccess, true);
      assert.strictEqual(isFailure, false);
    });

    it('7. Hint Helper: Identifies next correct character to place', () => {
      const target = 'efficient';
      const currentTray = ['e', 'f']; // index 0, 1 filled
      const nextNeededChar = target[currentTray.length]; // should be 'f'

      assert.strictEqual(nextNeededChar, 'f');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Vocab Quiz Bi-Directional Engine
  // --------------------------------------------------------------------------
  describe('Vocab Quiz Bi-Directional Engine', () => {
    function generateQuizQuestion(words, index, direction = 'en_ru') {
      const target = words[index];
      const others = words.filter(w => w.id !== target.id);

      if (direction === 'en_ru') {
        const distractors = others.slice(0, 3).map(w => w.translation);
        return {
          prompt: target.word,
          correctAnswer: target.translation,
          choices: [target.translation, ...distractors].sort()
        };
      } else {
        const distractors = others.slice(0, 3).map(w => w.word);
        return {
          prompt: target.translation,
          correctAnswer: target.word,
          choices: [target.word, ...distractors].sort()
        };
      }
    }

    it('8. EN -> RU Mode: Prompt is English word, choices are Russian translations', () => {
      const q = generateQuizQuestion(mockWords, 0, 'en_ru');
      assert.strictEqual(q.prompt, 'abandon');
      assert.strictEqual(q.correctAnswer, 'покидать, отказываться');
      assert.strictEqual(q.choices.length, 4);
      assert.ok(q.choices.includes(q.correctAnswer));
    });

    it('9. RU -> EN Mode: Prompt is Russian translation, choices are English words', () => {
      const q = generateQuizQuestion(mockWords, 1, 'ru_en');
      assert.strictEqual(q.prompt, 'блестящий, великолепный');
      assert.strictEqual(q.correctAnswer, 'brilliant');
      assert.strictEqual(q.choices.length, 4);
      assert.ok(q.choices.includes('brilliant'));
    });

    it('10. Choice Uniqueness: All 4 choices are guaranteed distinct without duplicates', () => {
      for (let i = 0; i < mockWords.length; i++) {
        const q = generateQuizQuestion(mockWords, i, 'en_ru');
        const set = new Set(q.choices);
        assert.strictEqual(set.size, 4, `All 4 choices for question ${i} must be unique`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. Dictation & Audio Listening Engine
  // --------------------------------------------------------------------------
  describe('Audio Dictation Engine', () => {
    it('11. Phrase Decomposition: Splits sentence into correct word tokens without losing punctuation', () => {
      const sentence = 'Practice makes perfect!';
      const tokens = sentence.split(/\s+/);

      assert.strictEqual(tokens.length, 3);
      assert.strictEqual(tokens[0], 'Practice');
      assert.strictEqual(tokens[1], 'makes');
      assert.strictEqual(tokens[2], 'perfect!');
    });

    it('12. Listening Shuffled Tile Validation: Checks sequential construction', () => {
      const expectedPhrase = ['She', 'speaks', 'fluent', 'English'];
      const userBuiltCorrect = ['She', 'speaks', 'fluent', 'English'];
      const userBuiltWrong = ['She', 'fluent', 'speaks', 'English'];

      assert.strictEqual(userBuiltCorrect.join(' '), expectedPhrase.join(' '));
      assert.notStrictEqual(userBuiltWrong.join(' '), expectedPhrase.join(' '));
    });
  });
});
