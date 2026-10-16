import React, { useState, useEffect } from 'react';
import { Card, Button, Progress, Tag, Space, Typography } from 'antd';
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
import styles from './VocabQuiz.module.scss';

const { Title, Text, Paragraph } = Typography;

export interface VocabQuizProps {
  words: DictionaryItem[];
  initialDirection?: 'en-ru' | 'ru-en';
  onComplete?: (score: number, total: number, xpEarned: number) => void;
  onClose?: () => void;
  onNeedMore?: () => void;
}

interface QuestionItem {
  targetWord: DictionaryItem;
  options: {
    id: number;
    text: string;
    isCorrect: boolean;
  }[];
}

export const VocabQuiz: React.FC<VocabQuizProps> = ({
  words,
  initialDirection = 'en-ru',
  onComplete,
  onClose,
  onNeedMore
}) => {
  const [direction, setDirection] = useState<'en-ru' | 'ru-en'>(initialDirection);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const usedWordIdsRef = React.useRef<Set<number>>(new Set());

  // Build questions
  const generateQuestions = (wordList: DictionaryItem[], dir: 'en-ru' | 'ru-en', preferUnused = true) => {
    if (wordList.length === 0) return [];

    let availableWords = preferUnused
      ? wordList.filter(w => !usedWordIdsRef.current.has(w.id))
      : wordList;

    if (availableWords.length < 15) {
      onNeedMore?.();
      if (availableWords.length < 4) {
        usedWordIdsRef.current.clear();
        availableWords = wordList;
      }
    }

    const shuffledWords = [...availableWords].sort(() => 0.5 - Math.random());
    const count = Math.min(shuffledWords.length, 15);
    const selectedTargets = shuffledWords.slice(0, count);

    selectedTargets.forEach(t => usedWordIdsRef.current.add(t.id));

    return selectedTargets.map(target => {
      const distractors = wordList
        .filter(w => w.id !== target.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

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
      const qs = generateQuestions(words, direction);
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

    // Pronounce English word automatically
    if (currentQ) {
      soundEffects.speak(currentQ.targetWord.word);
    }

    const remaining = questions.length - (currentIndex + 1);
    if (remaining < 5) {
      onNeedMore?.();
    }
  };

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
        <Paragraph>
          <Tag color="cyan" style={{ fontSize: '1.05rem', padding: '4px 12px' }}>
            <ThunderboltFilled /> +{xpEarned} XP получено
          </Tag>
        </Paragraph>

        <Space size="middle" style={{ marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={() => {
              const qs = generateQuestions(words, direction, true);
              setQuestions(qs);
              setCurrentIndex(0);
              setSelectedOptionId(null);
              setIsAnswered(false);
              setScore(0);
              setCombo(0);
              setIsFinished(false);
            }}
          >
            Следующие 15 заданий
          </Button>

          <Button
            size="large"
            icon={<RedoOutlined />}
            onClick={() => {
              const qs = generateQuestions(words, direction, false);
              setQuestions(qs);
              setCurrentIndex(0);
              setSelectedOptionId(null);
              setIsAnswered(false);
              setScore(0);
              setCombo(0);
              setIsFinished(false);
            }}
          >
            Повторить
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
      {/* Top Bar with direction, score and streak */}
      <div>
        <div className={styles.topBar}>
          <Space>
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
              {currentQ.targetWord.word}
              <Button
                type="text"
                shape="circle"
                icon={<SoundOutlined className={styles.soundBtn} />}
                onClick={() => soundEffects.speak(currentQ.targetWord.word)}
                title="Озвучить"
              />
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
            <div className={styles.targetWord} style={{ color: '#34d399' }}>
              {currentQ.targetWord.translation}
            </div>
            {currentQ.targetWord.definition && (
              <div className={styles.promptSub} style={{ marginTop: 8 }}>
                "{currentQ.targetWord.definition}"
              </div>
            )}
            <div className={styles.promptSub} style={{ marginTop: 12 }}>
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
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span className={styles.optionIndexBadge}>
                  {letters[idx]}
                </span>
                <span>{opt.text}</span>
              </div>
              {isAnswered && opt.isCorrect && <CheckOutlined style={{ color: '#34d399' }} />}
              {isAnswered && opt.id === selectedOptionId && !opt.isCorrect && (
                <CloseOutlined style={{ color: '#f87171' }} />
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
