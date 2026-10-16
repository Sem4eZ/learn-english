/**
 * LexiFlow Storage & State Manager
 * Handles local persistence, user stats, streak calculations, and word data.
 */

const STORAGE_KEYS = {
  WORDS: "lexiflow_words_v1",
  SRS_DATA: "lexiflow_srs_v1",
  USER_STATS: "lexiflow_stats_v1",
  SETTINGS: "lexiflow_settings_v1"
};

class StorageManager {
  constructor() {
    this.words = [];
    this.srsMap = {}; // cardId -> SRS record
    this.stats = {
      xp: 0,
      streak: 0,
      lastActiveDate: null,
      todayCount: 0,
      dailyGoal: 15,
      totalReviews: 0,
      correctAnswers: 0,
      quizGamesPlayed: 0
    };
    this.settings = {
      theme: "dark",
      voiceSpeed: 1.0,
      soundFx: true,
      speech: true,
      selectedVoiceUri: ""
    };

    this.init();
  }

  init() {
    this.loadSettings();
    this.loadStats();
    this.loadWords();
    this.updateStreak();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  }

  loadStats() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER_STATS);
      if (saved) {
        this.stats = { ...this.stats, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error("Failed to load stats:", e);
    }
  }

  saveStats() {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_STATS, JSON.stringify(this.stats));
    } catch (e) {
      console.error("Failed to save stats:", e);
    }
  }

  loadWords() {
    try {
      // 1. Load SRS records
      const savedSrs = localStorage.getItem(STORAGE_KEYS.SRS_DATA);
      if (savedSrs) {
        this.srsMap = JSON.parse(savedSrs);
      } else {
        this.srsMap = {};
      }

      // 2. Load custom/saved words
      const savedWords = localStorage.getItem(STORAGE_KEYS.WORDS);
      let wordList = [];
      if (savedWords) {
        wordList = JSON.parse(savedWords);
      } else if (typeof DEFAULT_VOCABULARY !== "undefined") {
        wordList = [...DEFAULT_VOCABULARY];
      }

      this.words = wordList;

      // Ensure every word has an SRS record
      this.words.forEach(w => {
        if (!this.srsMap[w.id]) {
          this.srsMap[w.id] = SRSEngine.createInitialRecord(w.id);
        }
      });

      this.saveSRS();
      this.saveWords();
    } catch (e) {
      console.error("Failed to load words:", e);
      if (typeof DEFAULT_VOCABULARY !== "undefined") {
        this.words = [...DEFAULT_VOCABULARY];
      }
    }
  }

  saveWords() {
    try {
      localStorage.setItem(STORAGE_KEYS.WORDS, JSON.stringify(this.words));
    } catch (e) {
      console.error("Failed to save words:", e);
    }
  }

  saveSRS() {
    try {
      localStorage.setItem(STORAGE_KEYS.SRS_DATA, JSON.stringify(this.srsMap));
    } catch (e) {
      console.error("Failed to save SRS records:", e);
    }
  }

  updateStreak() {
    const todayStr = new Date().toDateString();
    if (!this.stats.lastActiveDate) {
      this.stats.lastActiveDate = todayStr;
      this.stats.streak = 1;
      this.stats.todayCount = 0;
    } else if (this.stats.lastActiveDate !== todayStr) {
      const lastDate = new Date(this.stats.lastActiveDate);
      const diffTime = Math.abs(new Date(todayStr) - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Consecutive day
        this.stats.streak = (this.stats.streak || 0) + 1;
      } else if (diffDays > 1) {
        // Streak broken
        this.stats.streak = 1;
      }
      this.stats.todayCount = 0;
      this.stats.lastActiveDate = todayStr;
    }
    this.saveStats();
  }

  addXP(amount) {
    this.stats.xp = (this.stats.xp || 0) + amount;
    this.stats.todayCount = (this.stats.todayCount || 0) + 1;
    this.stats.totalReviews = (this.stats.totalReviews || 0) + 1;
    this.saveStats();
  }

  getLevelInfo() {
    const xp = this.stats.xp || 0;
    // Levels: 0-100 (1), 101-300 (2), 301-600 (3), etc.
    const level = Math.floor(Math.sqrt(xp / 50)) + 1;
    const currentLevelBaseXP = Math.pow(level - 1, 2) * 50;
    const nextLevelXP = Math.pow(level, 2) * 50;
    const progressXP = xp - currentLevelBaseXP;
    const neededXP = nextLevelXP - currentLevelBaseXP;
    const percentage = Math.min(100, Math.round((progressXP / neededXP) * 100));

    const titles = [
      "Beginner (Новичок)",
      "Explorer (Искатель)",
      "Apprentice (Ученик)",
      "Practitioner (Практик)",
      "Scholar (Знаток)",
      "Wordmaster (Мастер слов)",
      "Linguist (Лингвист)",
      "Expert (Эксперт)",
      "Sage (Мудрец)",
      "Polyglot (Полиглот)"
    ];

    const title = titles[Math.min(level - 1, titles.length - 1)];

    return {
      level,
      title,
      xp,
      progressXP,
      neededXP,
      percentage
    };
  }

  recordCardReview(wordId, grade) {
    let srs = this.srsMap[wordId] || SRSEngine.createInitialRecord(wordId);
    srs = SRSEngine.processReview(srs, grade);
    this.srsMap[wordId] = srs;
    this.saveSRS();

    // Reward XP based on grade
    const xpRewards = { 1: 5, 2: 10, 3: 15, 4: 25 };
    this.addXP(xpRewards[grade] || 10);
    return srs;
  }

  addCustomWord(wordData) {
    const id = "custom-" + Date.now();
    const newWord = {
      id,
      word: wordData.word.trim(),
      phonetic: wordData.phonetic ? wordData.phonetic.trim() : "",
      pos: wordData.pos || "noun",
      level: wordData.level || "B1",
      category: wordData.category || "My Words",
      translation: wordData.translation.trim(),
      definition: wordData.definition ? wordData.definition.trim() : "",
      example: wordData.example ? wordData.example.trim() : "",
      exampleTranslation: wordData.exampleTranslation ? wordData.exampleTranslation.trim() : "",
      synonyms: wordData.synonyms || []
    };

    this.words.unshift(newWord);
    this.srsMap[id] = SRSEngine.createInitialRecord(id);
    this.saveWords();
    this.saveSRS();
    this.addXP(20);
    return newWord;
  }

  deleteWord(wordId) {
    this.words = this.words.filter(w => w.id !== wordId);
    delete this.srsMap[wordId];
    this.saveWords();
    this.saveSRS();
  }

  getCardsDueForReview() {
    const now = new Date();
    return this.words.filter(w => {
      const srs = this.srsMap[w.id];
      return !srs || SRSEngine.isDue(srs, now);
    });
  }

  getWordsStats() {
    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let masteredCount = 0;

    this.words.forEach(w => {
      const srs = this.srsMap[w.id];
      if (!srs || srs.reps === 0) {
        newCount++;
      } else if (srs.state === "learning") {
        learningCount++;
      } else if (srs.state === "mastered") {
        masteredCount++;
      } else {
        reviewCount++;
      }
    });

    return {
      total: this.words.length,
      newCount,
      learningCount,
      reviewCount,
      masteredCount
    };
  }

  exportDataAsJSON() {
    const exportBundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      words: this.words,
      srs: this.srsMap,
      stats: this.stats,
      settings: this.settings
    };
    return JSON.stringify(exportBundle, null, 2);
  }

  importDataFromJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.words && Array.isArray(parsed.words)) {
        this.words = parsed.words;
      }
      if (parsed.srs && typeof parsed.srs === "object") {
        this.srsMap = parsed.srs;
      }
      if (parsed.stats) {
        this.stats = { ...this.stats, ...parsed.stats };
      }
      this.saveWords();
      this.saveSRS();
      this.saveStats();
      return true;
    } catch (e) {
      console.error("Import failed:", e);
      return false;
    }
  }

  resetProgress() {
    this.srsMap = {};
    this.words.forEach(w => {
      this.srsMap[w.id] = SRSEngine.createInitialRecord(w.id);
    });
    this.stats = {
      xp: 0,
      streak: 1,
      lastActiveDate: new Date().toDateString(),
      todayCount: 0,
      dailyGoal: 15,
      totalReviews: 0,
      correctAnswers: 0,
      quizGamesPlayed: 0
    };
    this.saveSRS();
    this.saveStats();
  }
}

if (typeof window !== "undefined") {
  window.storageMgr = new StorageManager();
}
