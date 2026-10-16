/**
 * LexiFlow Main Application Controller
 * Coordinates navigation, event listeners, UI rendering, SRS queue, and modes.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Global instances initialized in respective modules
  const storage = window.storageMgr;
  const audio = window.audioCtrl;
  const quiz = new QuizEngine(storage, audio);
  const builder = new BuilderEngine(storage, audio);

  // App State
  let currentCard = null;
  let srsDueCards = [];
  let srsCardIndex = 0;
  let isCardFlipped = false;

  // DOM Elements
  const headerStreak = document.getElementById("headerStreak");
  const headerXP = document.getElementById("headerXP");
  const headerLevel = document.getElementById("headerLevel");
  const themeToggleBtn = document.getElementById("themeToggleBtn");

  // Navigation
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabViews = document.querySelectorAll(".tab-view");

  // Toast System
  const toastContainer = document.getElementById("toastContainer");
  function showToast(message, icon = "✨") {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.translate = "20px 0";
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ================= THEME & SETTINGS =================
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    storage.settings.theme = theme;
    storage.saveSettings();
    themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  applyTheme(storage.settings.theme || "dark");
  themeToggleBtn.addEventListener("click", () => {
    const newTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(newTheme);
    showToast(newTheme === "dark" ? "Темная тема включена" : "Светлая тема включена", "🎨");
  });

  // ================= STATS & DASHBOARD =================
  function renderHeaderStats() {
    const lvl = storage.getLevelInfo();
    headerStreak.textContent = `${storage.stats.streak || 1} дн.`;
    headerXP.textContent = `${storage.stats.xp || 0} XP`;
    headerLevel.textContent = `Lvl ${lvl.level}`;
  }

  function renderDashboard() {
    renderHeaderStats();
    const lvl = storage.getLevelInfo();
    const wordStats = storage.getWordsStats();

    // Dashboard elements
    document.getElementById("dashLevelTitle").textContent = lvl.title;
    document.getElementById("dashLevelNumber").textContent = `Уровень ${lvl.level}`;
    document.getElementById("dashXPProgressText").textContent = `${lvl.progressXP} / ${lvl.neededXP} XP (${lvl.percentage}%)`;
    document.getElementById("dashXPProgressBar").style.width = `${lvl.percentage}%`;

    document.getElementById("dashStreakCount").textContent = `${storage.stats.streak || 1}`;
    document.getElementById("dashTotalWords").textContent = `${wordStats.total}`;
    document.getElementById("dashDueCount").textContent = `${storage.getCardsDueForReview().length}`;

    // Daily Goal
    const goalCount = storage.stats.todayCount || 0;
    const goalTarget = storage.stats.dailyGoal || 15;
    const goalPercent = Math.min(100, Math.round((goalCount / goalTarget) * 100));
    document.getElementById("dashDailyGoalText").textContent = `${goalCount} / ${goalTarget} слов`;
    document.getElementById("dashDailyGoalBar").style.width = `${goalPercent}%`;

    // Breakdown counts
    document.getElementById("countNewWords").textContent = wordStats.newCount;
    document.getElementById("countLearningWords").textContent = wordStats.learningCount;
    document.getElementById("countReviewWords").textContent = wordStats.reviewCount;
    document.getElementById("countMasteredWords").textContent = wordStats.masteredCount;

    const total = wordStats.total || 1;
    document.getElementById("barNewWords").style.width = `${(wordStats.newCount / total) * 100}%`;
    document.getElementById("barLearningWords").style.width = `${(wordStats.learningCount / total) * 100}%`;
    document.getElementById("barReviewWords").style.width = `${(wordStats.reviewCount / total) * 100}%`;
    document.getElementById("barMasteredWords").style.width = `${(wordStats.masteredCount / total) * 100}%`;
  }

  // ================= TAB NAVIGATION =================
  function switchTab(targetTabId) {
    tabButtons.forEach(b => {
      const isTarget = b.getAttribute("data-tab") === targetTabId;
      b.classList.toggle("active", isTarget);
      b.setAttribute("aria-selected", isTarget);
    });

    tabViews.forEach(v => {
      const isTarget = v.id === targetTabId;
      v.classList.toggle("active", isTarget);
    });

    // Lifecycle triggers per tab
    if (targetTabId === "view-dashboard") {
      renderDashboard();
    } else if (targetTabId === "view-flashcards") {
      initFlashcardsQueue();
    } else if (targetTabId === "view-dictionary") {
      renderDictionaryTable();
    } else if (targetTabId === "view-builder") {
      initBuilderUI();
    }
  }

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });

  // ================= SRS FLASHCARDS =================
  const flipCardEl = document.getElementById("srsFlipCard");
  const srsButtonsPanel = document.getElementById("srsButtonsPanel");
  const srsFlipHint = document.getElementById("srsFlipHint");

  function initFlashcardsQueue() {
    srsDueCards = storage.getCardsDueForReview();
    if (srsDueCards.length === 0) {
      // If all due cards are reviewed, offer all words for continuous practice
      srsDueCards = [...storage.words].sort(() => 0.5 - Math.random());
    }
    srsCardIndex = 0;
    renderCurrentCard();
  }

  function renderCurrentCard() {
    if (srsDueCards.length === 0 || srsCardIndex >= srsDueCards.length) {
      // Completed current queue!
      document.getElementById("srsCompletedBox").hidden = false;
      document.getElementById("srsActiveArea").hidden = true;
      showToast("Все запланированные карточки пройдены! 🚀", "🎉");
      audio.playFx("levelup");
      renderDashboard();
      return;
    }

    document.getElementById("srsCompletedBox").hidden = true;
    document.getElementById("srsActiveArea").hidden = false;

    currentCard = srsDueCards[srsCardIndex];
    isCardFlipped = false;
    flipCardEl.classList.remove("is-flipped");
    srsButtonsPanel.style.display = "none";
    srsFlipHint.style.display = "block";

    // Front Face
    document.getElementById("cardFrontWord").textContent = currentCard.word;
    document.getElementById("cardFrontPhonetic").textContent = currentCard.phonetic || "";
    document.getElementById("cardFrontPos").textContent = currentCard.pos || "";
    document.getElementById("cardFrontLevel").textContent = currentCard.level || "B1";
    document.getElementById("cardFrontLevel").className = `tag-badge ${(currentCard.level || "b1").toLowerCase()}`;
    document.getElementById("cardFrontCategory").textContent = currentCard.category || "General";

    // Back Face
    document.getElementById("cardBackWord").textContent = currentCard.word;
    document.getElementById("cardBackTranslation").textContent = currentCard.translation;
    document.getElementById("cardBackDefinition").textContent = currentCard.definition || "";
    document.getElementById("cardBackExEn").textContent = currentCard.example || "";
    document.getElementById("cardBackExRu").textContent = currentCard.exampleTranslation || "";

    // Queue counter
    document.getElementById("srsRemainingCount").textContent = `${srsDueCards.length - srsCardIndex}`;
  }

  function flipCard() {
    if (!currentCard) return;
    isCardFlipped = !isCardFlipped;
    flipCardEl.classList.toggle("is-flipped", isCardFlipped);
    audio.playFx("flip");

    if (isCardFlipped) {
      srsButtonsPanel.style.display = "grid";
      srsFlipHint.style.display = "none";
      audio.speak(currentCard.word);
    } else {
      srsButtonsPanel.style.display = "none";
      srsFlipHint.style.display = "block";
    }
  }

  flipCardEl.addEventListener("click", flipCard);

  // Audio inline buttons
  document.getElementById("btnSpeakCardWord").addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentCard) audio.speak(currentCard.word);
  });

  document.getElementById("btnSpeakCardExample").addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentCard && currentCard.example) audio.speak(currentCard.example);
  });

  // SRS Rating actions (1 to 4)
  document.querySelectorAll(".btn-rating").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const grade = parseInt(btn.getAttribute("data-grade"), 10);
      handleCardRating(grade);
    });
  });

  function handleCardRating(grade) {
    if (!currentCard) return;

    storage.recordCardReview(currentCard.id, grade);
    renderHeaderStats();

    if (grade === 1) {
      // Re-insert into queue for today
      srsDueCards.push(currentCard);
      showToast("Карточка вернется в текущей сессии", "🔄");
    } else if (grade === 4) {
      showToast("+25 XP! Отличный результат", "⭐");
    }

    srsCardIndex++;
    renderCurrentCard();
  }

  // Restart Flashcards button
  document.getElementById("btnRestartSRS").addEventListener("click", () => {
    initFlashcardsQueue();
  });

  // Keyboard Navigation for Flashcards
  window.addEventListener("keydown", (e) => {
    // Only apply shortcuts if flashcards view is active and not inside an input
    const flashcardView = document.getElementById("view-flashcards");
    if (!flashcardView.classList.contains("active")) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.code === "Space") {
      e.preventDefault();
      flipCard();
    } else if (isCardFlipped) {
      if (e.key === "1") handleCardRating(1);
      else if (e.key === "2") handleCardRating(2);
      else if (e.key === "3") handleCardRating(3);
      else if (e.key === "4") handleCardRating(4);
    }

    if (e.key.toLowerCase() === "r" && currentCard) {
      audio.speak(currentCard.word);
    }
  });

  // ================= QUIZ MODE =================
  const quizSetupPanel = document.getElementById("quizSetupPanel");
  const quizActivePanel = document.getElementById("quizActivePanel");
  const quizResultsPanel = document.getElementById("quizResultsPanel");
  const quizOptionsContainer = document.getElementById("quizOptionsContainer");

  document.getElementById("btnStartQuiz").addEventListener("click", () => {
    const level = document.getElementById("quizLevelFilter").value;
    const count = parseInt(document.getElementById("quizCountSelect").value, 10);
    const direction = document.getElementById("quizDirectionSelect").value;

    const started = quiz.startQuiz({ level, count, direction });
    if (!started) {
      showToast("Недостаточно слов для квиза с выбранными фильтрами", "⚠️");
      return;
    }

    quizSetupPanel.hidden = true;
    quizResultsPanel.hidden = true;
    quizActivePanel.hidden = false;
    renderQuizStep();
  });

  function renderQuizStep() {
    const qState = quiz.getCurrentQuizQuestion();
    if (!qState) return;

    document.getElementById("quizProgressBar").style.width = `${((qState.index) / qState.total) * 100}%`;
    document.getElementById("quizCounterText").textContent = `Вопрос ${qState.index + 1} из ${qState.total}`;
    document.getElementById("quizScoreLive").textContent = `Очки: ${quiz.quizScore}`;

    const promptText = qState.direction === "en-ru" ? qState.current.word.word : qState.current.word.translation;
    const promptSub = qState.direction === "en-ru" ? (qState.current.word.phonetic || "") : "";

    document.getElementById("quizQuestionWord").textContent = promptText;
    document.getElementById("quizQuestionPhonetic").textContent = promptSub;

    // Render 4 options
    quizOptionsContainer.innerHTML = "";
    qState.current.options.forEach(optWord => {
      const btn = document.createElement("button");
      btn.className = "btn-option";
      btn.textContent = qState.direction === "en-ru" ? optWord.translation : optWord.word;

      btn.addEventListener("click", () => {
        // Disable options during animation
        Array.from(quizOptionsContainer.children).forEach(c => c.disabled = true);

        const result = quiz.submitQuizAnswer(optWord.id);
        if (result.isCorrect) {
          btn.classList.add("correct");
        } else {
          btn.classList.add("wrong");
          // Highlight correct one
          Array.from(quizOptionsContainer.children).forEach(c => {
            const correctText = qState.direction === "en-ru" ? result.correctWord.translation : result.correctWord.word;
            if (c.textContent === correctText) {
              c.classList.add("correct");
            }
          });
        }

        renderHeaderStats();

        setTimeout(() => {
          if (result.isFinished) {
            showQuizResults(result);
          } else {
            renderQuizStep();
          }
        }, 1100);
      });

      quizOptionsContainer.appendChild(btn);
    });
  }

  function showQuizResults(result) {
    quizActivePanel.hidden = true;
    quizResultsPanel.hidden = false;

    document.getElementById("quizFinalScore").textContent = `${result.score} / ${result.total}`;
    const percent = Math.round((result.score / result.total) * 100);
    document.getElementById("quizFinalAccuracy").textContent = `${percent}% точности`;

    const xpEarned = result.score * 15;
    document.getElementById("quizFinalXP").textContent = `+${xpEarned} XP`;

    // Mistakes review
    const mistakesContainer = document.getElementById("quizMistakesList");
    mistakesContainer.innerHTML = "";

    if (result.mistakes.length === 0) {
      mistakesContainer.innerHTML = `<p style="color: var(--accent-success); font-weight: 600;">Безупречно! Ни одной ошибки 🎉</p>`;
      audio.playFx("levelup");
    } else {
      result.mistakes.forEach(m => {
        const item = document.createElement("div");
        item.style.padding = "10px";
        item.style.borderBottom = "1px solid var(--border-subtle)";
        item.style.textAlign = "left";
        item.innerHTML = `
          <strong>${m.word.word}</strong> — <span style="color: var(--accent-success)">${m.word.translation}</span> 
          <span style="font-size: 0.8rem; color: var(--accent-danger); margin-left: 8px;">(Ваш ответ: ${m.userSelection?.translation || "ошибка"})</span>
        `;
        mistakesContainer.appendChild(item);
      });
    }
  }

  document.getElementById("btnQuizRestart").addEventListener("click", () => {
    quizResultsPanel.hidden = true;
    quizSetupPanel.hidden = false;
  });

  // ================= SPEED SPRINT =================
  const sprintStartBox = document.getElementById("sprintStartBox");
  const sprintArenaBox = document.getElementById("sprintArenaBox");
  const sprintResultsBox = document.getElementById("sprintResultsBox");

  document.getElementById("btnStartSprint").addEventListener("click", () => {
    sprintStartBox.hidden = true;
    sprintResultsBox.hidden = true;
    sprintArenaBox.hidden = false;

    quiz.startSprint(
      (timeLeft) => {
        document.getElementById("sprintSeconds").textContent = `${timeLeft}с`;
        document.getElementById("sprintTimerFill").style.width = `${(timeLeft / 60) * 100}%`;
      },
      (summary) => {
        sprintArenaBox.hidden = true;
        sprintResultsBox.hidden = false;
        document.getElementById("sprintFinalScore").textContent = summary.score;
        document.getElementById("sprintFinalCombo").textContent = `Макс. комбо: 🔥 x${summary.maxCombo}`;
        document.getElementById("sprintFinalXP").textContent = `+${summary.xpEarned} XP`;
        renderHeaderStats();
        audio.playFx("levelup");
      }
    );

    renderSprintCard();
  });

  function renderSprintCard() {
    const q = quiz.currentSprintCard;
    if (!q) return;

    document.getElementById("sprintCardWord").textContent = q.word;
    document.getElementById("sprintCardTranslation").textContent = quiz.sprintIsMatch ? q.translation : (quiz.currentSprintCard.displayedTranslation || q.translation);
    document.getElementById("sprintLiveScore").textContent = `Очки: ${quiz.sprintScore}`;

    const comboEl = document.getElementById("sprintComboIndicator");
    if (quiz.sprintCombo >= 2) {
      comboEl.textContent = `🔥 x${quiz.sprintCombo}`;
      comboEl.style.display = "inline-flex";
    } else {
      comboEl.style.display = "none";
    }
  }

  document.getElementById("btnSprintTrue").addEventListener("click", () => {
    handleSprintChoice(true);
  });

  document.getElementById("btnSprintFalse").addEventListener("click", () => {
    handleSprintChoice(false);
  });

  function handleSprintChoice(choice) {
    const res = quiz.submitSprintAnswer(choice);
    if (!res) return;
    renderSprintCard();
  }

  document.getElementById("btnSprintRestart").addEventListener("click", () => {
    sprintResultsBox.hidden = true;
    sprintStartBox.hidden = false;
  });

  // Sprint hotkeys (Left / Right Arrow)
  window.addEventListener("keydown", (e) => {
    const sprintView = document.getElementById("view-sprint");
    if (!sprintView.classList.contains("active") || !quiz.sprintActive) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      handleSprintChoice(false);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      handleSprintChoice(true);
    }
  });

  // ================= WORD BUILDER & LISTENING =================
  const assembledSlotsArea = document.getElementById("assembledSlotsArea");
  const letterPoolArea = document.getElementById("letterPoolArea");

  function initBuilderUI(mode = "builder") {
    const state = builder.startExercise(null, mode);
    renderBuilderSlots(state);
  }

  function renderBuilderSlots(state) {
    if (!state || !state.word) return;

    document.getElementById("builderPromptTranslation").textContent = state.word.translation;
    document.getElementById("builderPromptPhonetic").textContent = state.word.phonetic || "";
    document.getElementById("builderPromptExample").textContent = state.word.example ? `«${state.word.example}»` : "";

    // Assembled area
    assembledSlotsArea.innerHTML = "";
    if (state.assembled.length === 0) {
      assembledSlotsArea.innerHTML = `<span style="color: var(--text-dim); font-size: 0.9rem;">Нажмите на буквы ниже, чтобы составить слово</span>`;
    } else {
      state.assembled.forEach(tile => {
        const btn = document.createElement("button");
        btn.className = "letter-tile";
        btn.textContent = tile.char;
        btn.addEventListener("click", () => {
          const nextState = builder.unselectLetter(tile.id);
          renderBuilderSlots(nextState);
        });
        assembledSlotsArea.appendChild(btn);
      });
    }

    // Letter pool
    letterPoolArea.innerHTML = "";
    state.scrambled.forEach(tile => {
      const btn = document.createElement("button");
      btn.className = `letter-tile ${tile.used ? "used" : ""}`;
      btn.textContent = tile.char;
      btn.disabled = tile.used;
      btn.addEventListener("click", () => {
        const nextState = builder.selectLetter(tile.id);
        renderBuilderSlots(nextState);
      });
      letterPoolArea.appendChild(btn);
    });

    if (state.completed) {
      renderHeaderStats();
      if (state.isCorrect) {
        showToast("Отлично! Слово собрано верно 🎉", "✅");
      } else {
        showToast("Попробуйте еще раз!", "❌");
      }
    }
  }

  document.getElementById("btnBuilderHint").addEventListener("click", () => {
    const nextState = builder.giveHint();
    renderBuilderSlots(nextState);
  });

  document.getElementById("btnBuilderReset").addEventListener("click", () => {
    const nextState = builder.resetCurrent();
    renderBuilderSlots(nextState);
  });

  document.getElementById("btnBuilderNext").addEventListener("click", () => {
    initBuilderUI();
  });

  document.getElementById("btnBuilderSpeak").addEventListener("click", () => {
    if (builder.currentWord) audio.speak(builder.currentWord.word);
  });

  // ================= DICTIONARY & WORD MANAGER =================
  const dictTableBody = document.getElementById("dictTableBody");
  const dictSearchInput = document.getElementById("dictSearchInput");
  const dictLevelFilter = document.getElementById("dictLevelFilter");
  const dictCategoryFilter = document.getElementById("dictCategoryFilter");

  function renderDictionaryTable() {
    const query = dictSearchInput.value.toLowerCase().trim();
    const level = dictLevelFilter.value;
    const cat = dictCategoryFilter.value;

    let filtered = storage.words.filter(w => {
      const matchQuery = !query || w.word.toLowerCase().includes(query) || w.translation.toLowerCase().includes(query);
      const matchLevel = level === "all" || w.level === level;
      const matchCat = cat === "all" || w.category === cat;
      return matchQuery && matchLevel && matchCat;
    });

    document.getElementById("dictFilteredCount").textContent = `${filtered.length} из ${storage.words.length} слов`;

    dictTableBody.innerHTML = "";
    if (filtered.length === 0) {
      dictTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-dim); padding: 30px;">Ничего не найдено</td></tr>`;
      return;
    }

    filtered.forEach(w => {
      const srs = storage.srsMap[w.id];
      const reps = srs ? srs.reps : 0;
      const stateBadge = reps >= 4 ? `<span style="color: var(--accent-success)">Выучено</span>` :
                         reps > 0 ? `<span style="color: var(--accent-warning)">Повторение</span>` :
                         `<span style="color: var(--accent-secondary)">Новое</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <button class="btn-icon" data-speak="${w.word}" style="width: 30px; height: 30px; font-size: 0.8rem;" title="Прослушать">🔊</button>
        </td>
        <td>
          <strong style="font-size: 1rem; color: var(--text-main);">${w.word}</strong>
          <span style="font-family: var(--font-mono); color: var(--text-dim); margin-left: 6px; font-size: 0.8rem;">${w.phonetic || ""}</span>
        </td>
        <td>${w.translation}</td>
        <td><span class="tag-badge ${(w.level || "b1").toLowerCase()}">${w.level || "B1"}</span></td>
        <td><span style="font-size: 0.8rem; color: var(--text-dim);">${w.category || "General"}</span></td>
        <td>${stateBadge}</td>
      `;

      tr.querySelector("[data-speak]").addEventListener("click", () => {
        audio.speak(w.word);
      });

      dictTableBody.appendChild(tr);
    });
  }

  dictSearchInput.addEventListener("input", renderDictionaryTable);
  dictLevelFilter.addEventListener("change", renderDictionaryTable);
  dictCategoryFilter.addEventListener("change", renderDictionaryTable);

  // Add Word Modal
  const addWordModal = document.getElementById("addWordModal");
  document.getElementById("btnOpenAddWordModal").addEventListener("click", () => {
    addWordModal.hidden = false;
  });

  document.getElementById("btnCloseAddWordModal").addEventListener("click", () => {
    addWordModal.hidden = true;
  });

  document.getElementById("formAddWord").addEventListener("submit", (e) => {
    e.preventDefault();
    const word = document.getElementById("newWordInput").value;
    const translation = document.getElementById("newTranslationInput").value;
    const level = document.getElementById("newLevelSelect").value;
    const category = document.getElementById("newCategoryInput").value || "My Words";
    const example = document.getElementById("newExampleInput").value;
    const exampleTranslation = document.getElementById("newExampleRuInput").value;

    if (!word || !translation) return;

    storage.addCustomWord({
      word,
      translation,
      level,
      category,
      example,
      exampleTranslation
    });

    addWordModal.hidden = true;
    document.getElementById("formAddWord").reset();
    showToast(`Слово «${word}» успешно добавлено! +20 XP`, "🎉");
    renderDashboard();
    renderDictionaryTable();
  });

  // Export / Import Data
  document.getElementById("btnExportData").addEventListener("click", () => {
    const jsonStr = storage.exportDataAsJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lexiflow_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Резервная копия сохранена в файл!", "💾");
  });

  document.getElementById("btnImportData").addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const success = storage.importDataFromJSON(re.target.result);
        if (success) {
          showToast("Данные успешно импортированы!", "✅");
          renderDashboard();
          renderDictionaryTable();
        } else {
          showToast("Ошибка импорта: неверный формат файла", "❌");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // Initial Load
  renderDashboard();
  renderDictionaryTable();
});
