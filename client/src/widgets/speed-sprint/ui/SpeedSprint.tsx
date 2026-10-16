import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Progress, Tag, Space, Typography } from 'antd';
import { 
  CheckOutlined, 
  CloseOutlined, 
  TrophyFilled,
  RedoOutlined,
  ThunderboltFilled,
  FireFilled,
  ClockCircleFilled
} from '@ant-design/icons';
import { DictionaryItem } from '@/entities/dictionary/model/types';
import { soundEffects } from '@/shared/lib/audio';
import { fireCelebration } from '@/shared/lib/confetti';
import { SRSEngine } from '@/shared/lib/srs';
import styles from './SpeedSprint.module.scss';

const { Title, Text, Paragraph } = Typography;

export interface SpeedSprintProps {
  words: DictionaryItem[];
  onComplete?: (score: number, maxCombo: number, xpEarned: number) => void;
  onClose?: () => void;
  onNeedMore?: () => void;
}

interface SprintPair {
  word: string;
  translation: string;
  isMatch: boolean;
  item: DictionaryItem;
}

export const SpeedSprint: React.FC<SpeedSprintProps> = ({
  words,
  onComplete,
  onClose,
  onNeedMore
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [currentPair, setCurrentPair] = useState<SprintPair | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (words.length < 25) {
      onNeedMore?.();
    }
  }, [words.length]);

  // Generate pair
  const pickNextPair = (wordList: DictionaryItem[], curCombo: number) => {
    if (wordList.length < 2) return null;

    const target = wordList[Math.floor(Math.random() * wordList.length)];
    const isMatch = Math.random() > 0.45;

    let translation = target.translation;
    if (!isMatch) {
      const distractors = wordList.filter(w => w.id !== target.id);
      const wrong = distractors[Math.floor(Math.random() * distractors.length)];
      translation = wrong.translation;
    }

    return {
      word: target.word,
      translation,
      isMatch,
      item: target
    };
  };

  const startNewGame = () => {
    setTimeLeft(60);
    setIsActive(true);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setFeedback(null);
    setIsFinished(false);
    setCurrentPair(pickNextPair(words, 0));
  };

  // Timer loop
  useEffect(() => {
    if (words.length >= 2) {
      startNewGame();
    }
  }, [words]);

  useEffect(() => {
    if (!isActive || isFinished) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleFinishGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isActive, isFinished, score, maxCombo]);

  const handleFinishGame = () => {
    setIsActive(false);
    setIsFinished(true);
    fireCelebration();
    const xpEarned = Math.round(score * 1.5);
    onComplete?.(score, maxCombo, xpEarned);
  };

  const handleAnswer = (userSaidMatch: boolean) => {
    if (!isActive || !currentPair) return;

    const isCorrect = userSaidMatch === currentPair.isMatch;

    if (isCorrect) {
      soundEffects.playCorrect();
      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo > maxCombo) setMaxCombo(newCombo);

      // Multiplier
      const mult = newCombo >= 10 ? 4 : newCombo >= 6 ? 3 : newCombo >= 3 ? 2 : 1;
      setScore(prev => prev + 10 * mult);
      setFeedback('correct');
    } else {
      soundEffects.playWrong();
      setCombo(0);
      setFeedback('wrong');
    }

    // Sync SRS review in background
    if (currentPair?.item) {
      SRSEngine.syncReviewWithServer(currentPair.item.id, isCorrect ? 3 : 1);
    }

    // Quick reset feedback and next card
    setTimeout(() => {
      setFeedback(null);
      setCurrentPair(pickNextPair(words, combo));
    }, 120);
  };

  // Keyboard navigation: Left = False, Right = True
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActive || isFinished) return;
      if (e.key === 'ArrowLeft' || e.key === 'n' || e.key === 'N') {
        handleAnswer(false);
      } else if (e.key === 'ArrowRight' || e.key === 'y' || e.key === 'Y' || e.key === ' ') {
        handleAnswer(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isFinished, currentPair, combo]);

  if (!words || words.length < 2) {
    return (
      <Card className={styles.summaryCard}>
        <Title level={4}>Недостаточно слов для спринта</Title>
        <Text type="secondary">В словаре должно быть как минимум 2 слова.</Text>
      </Card>
    );
  }

  if (isFinished) {
    const xpEarned = Math.round(score * 1.5);

    return (
      <Card className={styles.summaryCard}>
        <TrophyFilled className={styles.summaryTrophy} />
        <Title level={2}>Время вышло! Спринт окончен!</Title>
        <div className={styles.summaryScore}>
          {score} очков
        </div>
        <Paragraph type="secondary">
          Максимальная серия: <Tag color="warning"><FireFilled /> {maxCombo} подряд</Tag>
        </Paragraph>
        <Paragraph>
          <Tag color="cyan" className={styles.rewardTag}>
            <ThunderboltFilled /> +{xpEarned} XP получено
          </Tag>
        </Paragraph>

        <Space size="middle" className={styles.summaryActions} wrap>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltFilled className={styles.goldIcon} />}
            onClick={() => {
              onNeedMore?.();
              startNewGame();
            }}
            className={styles.primaryActionBtn}
          >
            Играть с новыми словами
          </Button>

          <Button
            size="large"
            icon={<RedoOutlined />}
            onClick={startNewGame}
          >
            Сыграть еще раз
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

  if (!currentPair) return null;

  const mult = combo >= 10 ? 4 : combo >= 6 ? 3 : combo >= 3 ? 2 : 1;
  const isUrgent = timeLeft <= 10;

  return (
    <div className={styles.sprintContainer}>
      {/* Top Bar with Timer and Score */}
      <div>
        <div className={styles.topBar}>
          <div className={`${styles.timerPill} ${isUrgent ? styles.urgent : ''}`}>
            <Tag color={isUrgent ? 'error' : 'processing'} className={styles.timerTag}>
              <ClockCircleFilled /> {timeLeft}с
            </Tag>
          </div>

          <Space size="middle">
            {combo >= 2 && (
              <Tag color="warning" className={styles.comboTag}>
                <FireFilled /> {combo}x ({mult}x Очки!)
              </Tag>
            )}
            <Tag color="cyan" className={styles.scoreTag}>
              <ThunderboltFilled /> {score} pts
            </Tag>
          </Space>
        </div>
        <Progress
          percent={Math.round((timeLeft / 60) * 100)}
          strokeColor={isUrgent ? '#ef4444' : '#06b6d4'}
          showInfo={false}
        />
      </div>

      {/* Sprint Flash Card */}
      <Card
        className={`${styles.sprintCard} ${
          feedback === 'correct' ? styles.feedbackCorrect : feedback === 'wrong' ? styles.feedbackWrong : ''
        }`}
      >
        {combo >= 3 && (
          <Tag color="warning" className={styles.comboBadge}>
            🔥 МНОЖИТЕЛЬ {mult}X
          </Tag>
        )}

        <div className={styles.wordDisplay}>
          {currentPair.word}
        </div>

        <div className={styles.translationDisplay}>
          {currentPair.translation}
        </div>

        <div className={styles.pairHint}>
          Верный ли перевод предложен для этого слова?
        </div>
      </Card>

      {/* Answer Buttons */}
      <div className={styles.controlsGrid}>
        <Button
          size="large"
          icon={<CloseOutlined />}
          className={`${styles.btnAction} ${styles.btnFalse}`}
          onClick={() => handleAnswer(false)}
        >
          НЕВЕРНО <span className={styles.keyHint}>[← / N]</span>
        </Button>

        <Button
          type="primary"
          size="large"
          icon={<CheckOutlined />}
          className={`${styles.btnAction} ${styles.btnTrue}`}
          onClick={() => handleAnswer(true)}
        >
          ВЕРНО <span className={styles.keyHint}>[→ / Y]</span>
        </Button>
      </div>
    </div>
  );
};
