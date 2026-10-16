/**
 * LexiFlow Word Builder & Listening Practice
 * Mode for letter-tile spelling assembly and audio dictation exercises.
 */

class BuilderEngine {
  constructor(storageMgr, audioCtrl) {
    this.storage = storageMgr;
    this.audio = audioCtrl;

    this.currentWord = null;
    this.scrambledLetters = [];
    this.assembledLetters = [];
    this.mode = "builder"; // 'builder' | 'listening'
  }

  startExercise(word = null, mode = "builder") {
    this.mode = mode;
    if (!word) {
      const pool = this.storage.words;
      if (pool.length === 0) return null;
      this.currentWord = pool[Math.floor(Math.random() * pool.length)];
    } else {
      this.currentWord = word;
    }

    const cleanWord = this.currentWord.word.toLowerCase().replace(/[^a-z]/g, "");
    const letters = cleanWord.split("").map((char, index) => ({
      char,
      id: `${char}-${index}`,
      used: false
    }));

    // Scramble letters
    this.scrambledLetters = [...letters].sort(() => 0.5 - Math.random());
    this.assembledLetters = [];

    if (this.mode === "listening") {
      // Automatically pronounce upon starting
      setTimeout(() => {
        this.audio.speak(this.currentWord.word);
      }, 200);
    }

    return this.getState();
  }

  selectLetter(letterId) {
    const tile = this.scrambledLetters.find(l => l.id === letterId);
    if (!tile || tile.used) return this.getState();

    tile.used = true;
    this.assembledLetters.push(tile);
    this.audio.playFx("flip");

    return this.checkAutoSubmit();
  }

  unselectLetter(letterId) {
    const index = this.assembledLetters.findIndex(l => l.id === letterId);
    if (index === -1) return this.getState();

    const removed = this.assembledLetters.splice(index, 1)[0];
    const originalTile = this.scrambledLetters.find(l => l.id === removed.id);
    if (originalTile) originalTile.used = false;

    this.audio.playFx("flip");
    return this.getState();
  }

  resetCurrent() {
    this.assembledLetters = [];
    this.scrambledLetters.forEach(l => l.used = false);
    return this.getState();
  }

  giveHint() {
    const targetClean = this.currentWord.word.toLowerCase().replace(/[^a-z]/g, "");
    const currentLen = this.assembledLetters.length;

    if (currentLen >= targetClean.length) return this.getState();

    const nextNeededChar = targetClean[currentLen];
    const availableTile = this.scrambledLetters.find(l => l.char === nextNeededChar && !l.used);

    if (availableTile) {
      availableTile.used = true;
      this.assembledLetters.push(availableTile);
      this.audio.playFx("flip");
    }

    return this.checkAutoSubmit();
  }

  checkAutoSubmit() {
    const targetClean = this.currentWord.word.toLowerCase().replace(/[^a-z]/g, "");
    const currentBuilt = this.assembledLetters.map(l => l.char).join("");

    if (currentBuilt.length === targetClean.length) {
      const isCorrect = currentBuilt === targetClean;
      if (isCorrect) {
        this.audio.playFx("correct");
        this.audio.speak(this.currentWord.word);
        this.storage.addXP(15);
      } else {
        this.audio.playFx("wrong");
      }
      return {
        ...this.getState(),
        completed: true,
        isCorrect
      };
    }

    return this.getState();
  }

  checkTypedInput(inputString) {
    const targetClean = this.currentWord.word.toLowerCase().trim();
    const userClean = inputString.toLowerCase().trim();
    const isCorrect = userClean === targetClean;

    if (isCorrect) {
      this.audio.playFx("correct");
      this.audio.speak(this.currentWord.word);
      this.storage.addXP(20);
    } else {
      this.audio.playFx("wrong");
    }

    return {
      isCorrect,
      correctWord: this.currentWord.word,
      inputString
    };
  }

  getState() {
    return {
      word: this.currentWord,
      scrambled: this.scrambledLetters,
      assembled: this.assembledLetters,
      mode: this.mode
    };
  }
}

if (typeof window !== "undefined") {
  window.BuilderEngine = BuilderEngine;
}
