/**
 * LexiFlow Quiz & Sprint Engine
 * Handles multiple-choice quiz and 60-second speed sprint training modes.
 */

class QuizEngine {
  constructor(storageMgr, audioCtrl) {
    this.storage = storageMgr;
    this.audio = audioCtrl;

    // Standard Quiz State
    this.quizActive = false;
    this.quizQuestions = [];
    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizMistakes = [];
    this.quizDirection = "en-ru"; // 'en-ru' | 'ru-en'

    // Sprint State
    this.sprintActive = false;
    this.sprintTimer = null;
    this.sprintTimeLeft = 60;
    this.sprintScore = 0;
    this.sprintCombo = 0;
    this.sprintMaxCombo = 0;
    this.currentSprintCard = null;
    this.sprintIsMatch = true;
  }

  // ================= STANDARD QUIZ =================

  startQuiz(options = {}) {
    const { level = "all", count = 10, direction = "en-ru" } = options;
    this.quizDirection = direction;

    let pool = [...this.storage.words];
    if (level !== "all") {
      pool = pool.filter(w => w.level === level);
      if (pool.length < 4) {
        pool = [...this.storage.words]; // fallback if not enough words in level
      }
    }

    if (pool.length < 4) return false;

    // Shuffle and pick `count` words
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(count, pool.length));

    this.quizQuestions = selected.map(targetWord => {
      // Pick 3 distractors
      const distractors = pool
        .filter(w => w.id !== targetWord.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const options = [targetWord, ...distractors].sort(() => 0.5 - Math.random());

      return {
        word: targetWord,
        options: options
      };
    });

    this.quizIndex = 0;
    this.quizScore = 0;
    this.quizMistakes = [];
    this.quizActive = true;
    return true;
  }

  getCurrentQuizQuestion() {
    if (!this.quizActive || this.quizIndex >= this.quizQuestions.length) return null;
    return {
      current: this.quizQuestions[this.quizIndex],
      index: this.quizIndex,
      total: this.quizQuestions.length,
      direction: this.quizDirection
    };
  }

  submitQuizAnswer(selectedWordId) {
    if (!this.quizActive) return null;

    const currentQ = this.quizQuestions[this.quizIndex];
    const isCorrect = selectedWordId === currentQ.word.id;

    if (isCorrect) {
      this.quizScore++;
      this.storage.addXP(15);
      this.storage.stats.correctAnswers = (this.storage.stats.correctAnswers || 0) + 1;
      this.audio.playFx("correct");
    } else {
      this.quizMistakes.push({
        word: currentQ.word,
        userSelection: this.storage.words.find(w => w.id === selectedWordId)
      });
      this.audio.playFx("wrong");
    }

    // Pronounce the English word
    this.audio.speak(currentQ.word.word);

    this.quizIndex++;
    const isFinished = this.quizIndex >= this.quizQuestions.length;

    if (isFinished) {
      this.quizActive = false;
      this.storage.stats.quizGamesPlayed = (this.storage.stats.quizGamesPlayed || 0) + 1;
      this.storage.saveStats();
    }

    return {
      isCorrect,
      correctWord: currentQ.word,
      isFinished,
      score: this.quizScore,
      total: this.quizQuestions.length,
      mistakes: this.quizMistakes
    };
  }

  // ================= SPEED SPRINT =================

  startSprint(onTick, onEnd) {
    this.sprintActive = true;
    this.sprintTimeLeft = 60;
    this.sprintScore = 0;
    this.sprintCombo = 0;
    this.sprintMaxCombo = 0;

    this.nextSprintQuestion();

    if (this.sprintTimer) clearInterval(this.sprintTimer);
    this.sprintTimer = setInterval(() => {
      this.sprintTimeLeft--;
      if (onTick) onTick(this.sprintTimeLeft);

      if (this.sprintTimeLeft <= 0) {
        this.stopSprint();
        if (onEnd) {
          onEnd({
            score: this.sprintScore,
            maxCombo: this.sprintMaxCombo,
            xpEarned: Math.round(this.sprintScore * 2)
          });
        }
      }
    }, 1000);
  }

  nextSprintQuestion() {
    const pool = this.storage.words;
    if (pool.length < 2) return null;

    const targetWord = pool[Math.floor(Math.random() * pool.length)];
    // 50% probability of true match, 50% false match
    const isMatch = Math.random() > 0.45;

    let displayedTranslation = targetWord.translation;
    if (!isMatch) {
      const distractors = pool.filter(w => w.id !== targetWord.id);
      const wrongWord = distractors[Math.floor(Math.random() * distractors.length)];
      displayedTranslation = wrongWord.translation;
    }

    this.currentSprintCard = targetWord;
    this.sprintIsMatch = isMatch;

    return {
      word: targetWord.word,
      translation: displayedTranslation,
      level: targetWord.level,
      combo: this.sprintCombo,
      score: this.sprintScore
    };
  }

  submitSprintAnswer(userAnswerBool) {
    if (!this.sprintActive || !this.currentSprintCard) return null;

    const isCorrect = userAnswerBool === this.sprintIsMatch;

    if (isCorrect) {
      this.sprintCombo++;
      if (this.sprintCombo > this.sprintMaxCombo) {
        this.sprintMaxCombo = this.sprintCombo;
      }

      // Combo multiplier: 1x, 2x (combo>=3), 3x (combo>=6), 4x (combo>=10)
      const multiplier = this.sprintCombo >= 10 ? 4 : this.sprintCombo >= 6 ? 3 : this.sprintCombo >= 3 ? 2 : 1;
      const points = 10 * multiplier;
      this.sprintScore += points;

      if (this.sprintCombo >= 3 && this.sprintCombo % 3 === 0) {
        this.audio.playFx("combo");
      } else {
        this.audio.playFx("correct");
      }
    } else {
      this.sprintCombo = 0;
      this.audio.playFx("wrong");
    }

    const nextQ = this.nextSprintQuestion();
    return {
      isCorrect,
      combo: this.sprintCombo,
      score: this.sprintScore,
      next: nextQ
    };
  }

  stopSprint() {
    this.sprintActive = false;
    if (this.sprintTimer) {
      clearInterval(this.sprintTimer);
      this.sprintTimer = null;
    }
    // Grant XP
    const xp = Math.round(this.sprintScore * 1.5);
    if (xp > 0) this.storage.addXP(xp);
  }
}

if (typeof window !== "undefined") {
  window.QuizEngine = QuizEngine;
}
