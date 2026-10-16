import React, { useState, useEffect } from 'react';
import { Card, Button, Progress, Tag, Space, Typography, Segmented } from 'antd';
import { 
  SoundOutlined, 
  CheckOutlined, 
  CloseOutlined, 
  ArrowRightOutlined, 
  TrophyFilled,
  RedoOutlined,
  ThunderboltFilled,
  FireFilled,
  SwapOutlined
} from '@ant-design/icons';
import { DictionaryItem } from '@/entities/dictionary/model/types';
import { soundEffects } from '@/shared/lib/audio';
import { fireCelebration } from '@/shared/lib/confetti';
import { SRSEngine } from '@/shared/lib/srs';
import styles from './VocabQuiz.module.scss';

const { Title, Text, Paragraph } = Typography;

export interface VocabQuizProps {
  words: DictionaryItem[];
  initialDirection?: 'en-ru' | 'ru-en';
  onComplete?: (score: number, total: number, xpEarned: number) => void;
  onClose?: () => void;
  onNeedMore?: () => Promise<DictionaryItem[]> | void;
}

interface QuestionItem {
  targetWord: DictionaryItem;
  options: {
    id: number;
    text: string;
    isCorrect: boolean;
  }[];
}

export type RoundMode = '15' | '30' | '45' | '60' | 'all';

export const VocabQuiz: React.FC<VocabQuizProps> = ({
  words,
  initialDirection = 'en-ru',
  onComplete,
  onClose,
  onNeedMore
}) => {
  const [direction, setDirection] = useState<'en-ru' | 'ru-en'>(initialDirection);
  const [roundMode, setRoundMode] = useState<RoundMode>('15');
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [loadingNext, setLoadingNext] = useState<boolean>(false);
  const usedWordIdsRef = React.useRef<Set<number>>(new Set());

  // Build questions
  const generateQuestions = (
    wordList: DictionaryItem[], 
    dir: 'en-ru' | 'ru-en', 
    preferUnused = true,
    mode: RoundMode = roundMode
  ) => {
    if (wordList.length === 0) return [];

    let availableWords = preferUnused
      ? wordList.filter(w => !usedWordIdsRef.current.has(w.id))
      : wordList;

    const targetCount = mode === 'all' 
      ? availableWords.length 
      : parseInt(mode, 10) || 15;

    if (availableWords.length < targetCount) {
      onNeedMore?.();
      if (availableWords.length < 4) {
        usedWordIdsRef.current.clear();
        availableWords = wordList;
      }
    }

    const shuffledWords = [...availableWords].sort(() => 0.5 - Math.random());
    const count = mode === 'all' 
      ? shuffledWords.length 
      : Math.min(shuffledWords.length, targetCount);
    const selectedTargets = shuffledWords.slice(0, count);

    selectedTargets.forEach(t => usedWordIdsRef.current.add(t.id));

    return selectedTargets.map(target => {
      const targetText = (dir === 'en-ru' ? target.translation : target.word).trim().toLowerCase();
      const seenTexts = new Set<string>([targetText]);
      const distractors: DictionaryItem[] = [];

      const pool = [...wordList].sort(() => 0.5 - Math.random());
      for (const w of pool) {
        if (w.id === target.id) continue;
        const text = (dir === 'en-ru' ? w.translation : w.word).trim().toLowerCase();
        if (text && !seenTexts.has(text)) {
          seenTexts.add(text);
          distractors.push(w);
          if (distractors.length >= 3) break;
        }
      }

      const allFour = [target, ...distractors];
      const shuffledOptions = allFour
        .sort(() => 0.5 - Math.random())
        .map(item => ({
          id: item.id,
          text: dir === 'en-ru' ? item.translation : item.word,
          isCorrect: item.id === target.id
        }));

      return {
        targetWord: target,
        options: shuffledOptions
      };
    });
  };

  useEffect(() => {
    if (questions.length === 0 && words.length > 0) {
      const qs = generateQuestions(words, direction, true, roundMode);
      setQuestions(qs);
      setCurrentIndex(0);
      setSelectedOptionId(null);
      setIsAnswered(false);
      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      setIsFinished(false);
    }
  }, [words, direction]);

  const handleRoundModeChange = (modeVal: string | number) => {
    const newMode = modeVal as RoundMode;
    setRoundMode(newMode);
    const qs = generateQuestions(words, direction, true, newMode);
    setQuestions(qs);
    setCurrentIndex(0);
    setSelectedOptionId(null);
    setIsAnswered(false);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setIsFinished(false);
  };

  const currentQ = questions[currentIndex];

  const handleSelectOption = (optionId: number, isCorrect: boolean) => {
    if (isAnswered) return;

    setSelectedOptionId(optionId);
    setIsAnswered(true);

    if (isCorrect) {
      soundEffects.playCorrect();
      setScore(prev => prev + 1);
      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo > maxCombo) setMaxCombo(newCombo);
    } else {
      soundEffects.playWrong();
      setCombo(0);
    }

    // Pronounce English word automatically and sync SRS review
    if (currentQ) {
      soundEffects.speak(currentQ.targetWord.word);
      // Grade 3 (Хорошо) postpones word for 1-3 days; Grade 1 (Снова) schedules for repeat in session
      SRSEngine.syncReviewWithServer(currentQ.targetWord.id, isCorrect ? 3 : 1);
    }

    // Auto-request next batch of words when remaining questions < 5
    const remaining = questions.length - (currentIndex + 1);
    if (remaining < 5) {
      onNeedMore?.();
    }
  };

  // Auto-pronounce English word when question is displayed
  useEffect(() => {
    if (currentQ && direction === 'en-ru' && !isFinished) {
      const timer = setTimeout(() => {
        soundEffects.speak(currentQ.targetWord.word);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, direction, isFinished, currentQ]);

  const handleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      fireCelebration();
      setIsFinished(true);
      const xpEarned = score * 15 + maxCombo * 5;
      onComplete?.(score, questions.length, xpEarned);
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedOptionId(null);
      setIsAnswered(false);
    }
  };

  const handleToggleDirection = () => {
    setDirection(prev => (prev === 'en-ru' ? 'ru-en' : 'en-ru'));
  };

  const handleLearnNewWords = async () => {
    let currentWords = words;
    let unstudied = currentWords.filter(w => !usedWordIdsRef.current.has(w.id));

    if (unstudied.length < 15 && onNeedMore) {
      setLoadingNext(true);
      try {
        const fresh = await onNeedMore();
        if (fresh && fresh.length > 0) {
          const existingIds = new Set(currentWords.map(w => w.id));
          const brandNew = fresh.filter(w => !existingIds.has(w.id));
          currentWords = [...currentWords, ...brandNew];
        }
      } catch (err) {
        console.warn('Failed to load next words:', err);
      } finally {
        setLoadingNext(false);
      }
    }

    const qs = generateQuestions(currentWords, direction, true);
    if (qs.length > 0) {
      setQuestions(qs);
      setCurrentIndex(0);
      setSelectedOptionId(null);
      setIsAnswered(false);
      setScore(0);
      setCombo(0);
      setIsFinished(false);
    }
  };

  if (!words || words.length < 2) {
    return (
      <Card className={styles.summaryCard}>
        <Title level={4}>Недостаточно слов для квиза</Title>
        <Text type="secondary">В словаре должно быть как минимум 2-4 слова.</Text>
      </Card>
    );
  }

  if (isFinished) {
    const accuracy = Math.round((score / questions.length) * 100);
    const xpEarned = score * 15 + maxCombo * 5;

    return (
      <Card className={styles.summaryCard}>
        <TrophyFilled className={styles.summaryTrophy} />
        <Title level={2}>Квиз завершен!</Title>
        <div className={styles.summaryScore}>
          {score} / {questions.length}
        </div>
        <Paragraph type="secondary">
          Точность ответов: <Text strong>{accuracy}%</Text> • Макс. комбо: <Tag color="warning"><FireFilled /> {maxCombo}</Tag>
        </Paragraph>
        <div className={styles.srsNoticeBox}>
          💡 <Text strong className={styles.srsNoticeTitle}>Интервальное повторение:</Text> слова, на которые вы ответили верно, запланированы на повторение через 1–3 дня для надежного закрепления. Сейчас вам будут предложены новые свежие слова!
        </div>
        <Paragraph>
          <Tag color="cyan" className={styles.rewardTag}>
            <ThunderboltFilled /> +{xpEarned} XP получено
          </Tag>
        </Paragraph>

        <Space size="middle" className={styles.summaryActions} wrap>
          <Button
            type="primary"
            size="large"
            loading={loadingNext}
            icon={<ThunderboltFilled className={styles.goldIcon} />}
            onClick={handleLearnNewWords}
            className={styles.primaryActionBtn}
          >
            {roundMode === 'all' ? 'Пройти новые слова' : `Изучить следующие слова (+${roundMode})`}
          </Button>

          <Button
            size="large"
            icon={<RedoOutlined />}
            onClick={() => {
              const qs = generateQuestions(words, direction, false, roundMode);
              setQuestions(qs);
              setCurrentIndex(0);
              setSelectedOptionId(null);
              setIsAnswered(false);
              setScore(0);
              setCombo(0);
              setIsFinished(false);
            }}
          >
            Пройти снова
          </Button>

          {onClose && (
            <Button size="large" onClick={onClose}>
              Вернуться
            </Button>
          )}
        </Space>
      </Card>
    );
  }

  if (!currentQ) return null;

  const letters = ['A', 'B', 'C', 'D'];
  const progressPercent = Math.round(((currentIndex) / questions.length) * 100);

  return (
    <div className={styles.quizContainer}>
      {/* Top Bar with direction, round mode, score and streak */}
      <div>
        <div className={styles.topBar}>
          <Space wrap size="middle">
            <Text type="secondary" strong>
              Вопрос {currentIndex + 1} из {questions.length}
            </Text>
            <Button 
              size="small" 
              icon={<SwapOutlined />}
              onClick={handleToggleDirection}
              disabled={isAnswered}
            >
              {direction === 'en-ru' ? 'EN ➔ RU' : 'RU ➔ EN'}
            </Button>
            <Segmented
              size="small"
              value={roundMode}
              onChange={handleRoundModeChange}
              disabled={isAnswered}
              options={[
                { label: '15', value: '15' },
                { label: '30', value: '30' },
                { label: '45', value: '45' },
                { label: '60', value: '60' },
                { label: `Все (${words.length})`, value: 'all' }
              ]}
            />
          </Space>

          <Space>
            {combo >= 2 && (
              <Tag color="warning">
                <FireFilled /> Стрик {combo}x!
              </Tag>
            )}
            <Tag color="cyan">
              <ThunderboltFilled /> {score * 15} XP
            </Tag>
          </Space>
        </div>
        <Progress percent={progressPercent} strokeColor="#6366f1" showInfo={false} />
      </div>

      {/* Target Word Card */}
      <Card className={styles.questionCard}>
        <div className={styles.directionTag}>
          <Tag color="purple">{currentQ.targetWord.level || 'B1'}</Tag>
          {currentQ.targetWord.section_id && (
            <Tag color="blue">{currentQ.targetWord.section_id}</Tag>
          )}
        </div>

        {direction === 'en-ru' ? (
          <div>
            <div className={styles.targetWord}>
              <span>{currentQ.targetWord.word}</span>
              <button
                type="button"
                className={styles.soundBtnCircle}
                onClick={(e) => {
                  e.stopPropagation();
                  soundEffects.speak(currentQ.targetWord.word);
                }}
                title="Озвучить"
              >
                <SoundOutlined />
              </button>
            </div>
            {currentQ.targetWord.transcription && (
              <div className={styles.phonetic}>
                {currentQ.targetWord.transcription}
              </div>
            )}
            <div className={styles.promptSub}>
              Выберите правильный перевод:
            </div>
          </div>
        ) : (
          <div>
            <div className={`${styles.targetWord} ${styles.targetWordRu}`}>
              {currentQ.targetWord.translation}
            </div>
            {currentQ.targetWord.definition && (
              <div className={`${styles.promptSub} ${styles.subTextMarginSmall}`}>
                "{currentQ.targetWord.definition}"
              </div>
            )}
            <div className={`${styles.promptSub} ${styles.subTextMarginMedium}`}>
              Выберите английский эквивалент:
            </div>
          </div>
        )}
      </Card>

      {/* 4 Choices Grid */}
      <div className={styles.optionsGrid}>
        {currentQ.options.map((opt, idx) => {
          let btnClass = styles.optionButton;
          if (isAnswered) {
            if (opt.isCorrect) {
              btnClass += ` ${styles.correctOption}`;
            } else if (opt.id === selectedOptionId) {
              btnClass += ` ${styles.wrongOption}`;
            }
          }

          return (
            <Button
              key={opt.id}
              className={btnClass}
              onClick={() => handleSelectOption(opt.id, opt.isCorrect)}
              disabled={isAnswered && opt.id !== selectedOptionId && !opt.isCorrect}
            >
              <div className={styles.optionContent}>
                <span className={styles.optionIndexBadge}>
                  {letters[idx]}
                </span>
                <span>{opt.text}</span>
              </div>
              {isAnswered && opt.isCorrect && <CheckOutlined className={styles.correctIcon} />}
              {isAnswered && opt.id === selectedOptionId && !opt.isCorrect && (
                <CloseOutlined className={styles.wrongIcon} />
              )}
            </Button>
          );
        })}
      </div>

      {/* Explanation when answered */}
      {isAnswered && (
        <div className={styles.explanationBox}>
          {currentQ.targetWord.example_sentence && (
            <div className={styles.exampleEn}>
              "{currentQ.targetWord.example_sentence}"
            </div>
          )}
          {currentQ.targetWord.example_translation && (
            <div className={styles.exampleRu}>
              {currentQ.targetWord.example_translation}
            </div>
          )}
          {currentQ.targetWord.definition && !currentQ.targetWord.example_sentence && (
            <div className={styles.exampleRu}>
              {currentQ.targetWord.definition}
            </div>
          )}
        </div>
      )}

      {/* Next Button */}
      {isAnswered && (
        <div className={styles.actionRow}>
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={handleNext}
            className={styles.nextBtn}
          >
            {currentIndex + 1 >= questions.length ? 'Завершить квиз' : 'Следующий вопрос'}
          </Button>
        </div>
      )}
    </div>
  );
};
