import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, Tag, Progress, Alert } from 'antd';
import { 
  CustomerServiceOutlined, 
  SoundOutlined, 
  CheckOutlined, 
  ReloadOutlined, 
  ArrowRightOutlined,
  ThunderboltFilled,
  TrophyFilled
} from '@ant-design/icons';
import { soundEffects } from '@/shared/lib/audio';
import { fireCelebration } from '@/shared/lib/confetti';
import { SRSEngine } from '@/shared/lib/srs';
import styles from './AudioChallenge.module.scss';

const { Title, Text, Paragraph } = Typography;

export interface AudioItem {
  id: number | string;
  sentence: string;
  translation: string;
  hint?: string;
  level?: string;
}

interface AudioChallengeProps {
  items: AudioItem[];
  onComplete?: (score: number) => void;
  onRefresh?: () => void;
  onNeedMore?: () => void;
}

// Clean punctuation and split into tokens
function tokenizeSentence(sentence: string): string[] {
  return sentence
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ''))
    .filter(Boolean);
}

function shuffle<T>(arr: T[]): T[] {
  const res = [...arr];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
}

export const AudioChallenge: React.FC<AudioChallengeProps> = ({
  items,
  onComplete,
  onRefresh,
  onNeedMore,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [availableTokens, setAvailableTokens] = useState<{ id: number; word: string }[]>([]);
  const [speed, setSpeed] = useState<number>(0.95);
  const [isVerified, setIsVerified] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentItem = items[currentIndex];

  useEffect(() => {
    if (!currentItem) return;
    const tokens = tokenizeSentence(currentItem.sentence);
    const shuffled = shuffle(tokens).map((word, idx) => ({ id: idx, word }));
    setAvailableTokens(shuffled);
    setSelectedTokens([]);
    setIsVerified(false);
    setIsCorrect(false);

    // Auto-play audio on question load
    const timer = setTimeout(() => {
      soundEffects.speak(currentItem.sentence, { rate: speed });
    }, 400);
    return () => clearTimeout(timer);
  }, [currentIndex, items]);

  const handlePlayAudio = (rate = speed) => {
    if (!currentItem) return;
    soundEffects.speak(currentItem.sentence, { rate });
  };

  const handleSelectWord = (token: { id: number; word: string }) => {
    if (isVerified) return;
    setSelectedTokens(prev => [...prev, token.word]);
    setAvailableTokens(prev => prev.filter(t => t.id !== token.id));
  };

  const handleRemoveWord = (word: string, index: number) => {
    if (isVerified) return;
    setSelectedTokens(prev => prev.filter((_, i) => i !== index));
    setAvailableTokens(prev => [...prev, { id: Date.now() + Math.random(), word }]);
  };

  const handleVerify = () => {
    if (!currentItem) return;
    const targetTokens = tokenizeSentence(currentItem.sentence);
    const userTokens = selectedTokens.map(w => w.toLowerCase());
    const expectedTokens = targetTokens.map(w => w.toLowerCase());

    const isMatch = userTokens.join(' ') === expectedTokens.join(' ');
    setIsVerified(true);
    setIsCorrect(isMatch);

    if (isMatch) {
      soundEffects.playCorrect();
      setScore(prev => prev + 20);
    } else {
      soundEffects.playWrong();
    }

    if (currentItem?.id) {
      SRSEngine.syncReviewWithServer(currentItem.id, isMatch ? 3 : 1, 'audio');
    }
  };

  const handleNext = () => {
    const remaining = items.length - (currentIndex + 1);
    if (remaining < 4) {
      onNeedMore?.();
    }

    if (currentIndex + 1 >= items.length) {
      fireCelebration();
      setIsFinished(true);
      onComplete?.(score + (isCorrect ? 20 : 0));
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  if (!items || items.length === 0) {
    return (
      <Card className={styles.emptyCard}>
        <Title level={4}>Нет доступных заданий по аудированию</Title>
        <Text type="secondary">Переключитесь на другой курс или выберите другие задания.</Text>
      </Card>
    );
  }

  if (isFinished) {
    return (
      <Card className={styles.finishCard}>
        <TrophyFilled className={styles.finishTrophy} />
        <Title level={2}>Аудиотренировка завершена!</Title>
        <Paragraph type="secondary">
          Заработано <Tag color="cyan">+{score} XP</Tag> за понимание на слух!
        </Paragraph>
        <Space size="middle" wrap>
          <Button
            type="primary"
            size="large"
            icon={<ThunderboltFilled className={styles.goldIcon} />}
            onClick={() => {
              onNeedMore?.();
              onRefresh?.();
              setCurrentIndex(0);
              setScore(0);
              setIsFinished(false);
            }}
            className={styles.primaryActionBtn}
          >
            Изучить новые задания
          </Button>
          <Button
            size="large"
            icon={<ReloadOutlined />}
            onClick={() => {
              setCurrentIndex(0);
              setScore(0);
              setIsFinished(false);
            }}
          >
            Начать заново
          </Button>
        </Space>
      </Card>
    );
  }

  return (
    <div className={styles.challengeContainer}>
      {/* Top Status */}
      <div className={styles.controlsRow}>
        <Text type="secondary" strong>
          Аудиозадание {currentIndex + 1} из {items.length}
        </Text>
        <Space>
          {currentItem.level && <Tag color="purple">{currentItem.level}</Tag>}
          <Tag color="cyan">
            <ThunderboltFilled className={styles.goldIcon} />
            +{score} XP
          </Tag>
        </Space>
      </div>

      <Progress
        percent={Math.round(((currentIndex) / items.length) * 100)}
        strokeColor="#06b6d4"
        showInfo={false}
      />

      {/* Big Audio Player Card */}
      <Card className={styles.audioPlayerCard}>
        <Title level={4} className={styles.cardTitle}>
          🎧 Послушайте фразу и соберите предложение
        </Title>

        <Button
          type="primary"
          shape="circle"
          icon={<CustomerServiceOutlined />}
          onClick={() => handlePlayAudio(speed)}
          className={styles.bigPlayButton}
        />

        <div>
          <Space size="middle" wrap className={styles.speedSelector}>
            <Button
              type={speed === 0.95 ? 'primary' : 'default'}
              size="small"
              onClick={() => {
                setSpeed(0.95);
                handlePlayAudio(0.95);
              }}
            >
              ⚡ 1.0x (Нормально)
            </Button>
            <Button
              type={speed === 0.72 ? 'primary' : 'default'}
              size="small"
              onClick={() => {
                setSpeed(0.72);
                handlePlayAudio(0.72);
              }}
            >
              🐢 0.75x (Медленно)
            </Button>
          </Space>
        </div>
      </Card>

      {/* Answer Drop Area */}
      <div 
        className={`${styles.answerArea} ${
          isVerified ? (isCorrect ? styles.correct : styles.wrong) : ''
        }`}
      >
        {selectedTokens.length === 0 ? (
          <Text type="secondary" className={styles.emptyAnswerHint}>
            Нажимайте на слова внизу, чтобы составить предложение...
          </Text>
        ) : (
          selectedTokens.map((word, idx) => (
            <Button
              key={idx}
              type="primary"
              className={styles.selectedWordChip}
              onClick={() => handleRemoveWord(word, idx)}
            >
              {word}
            </Button>
          ))
        )}
      </div>

      {/* Available Word Chips Pool */}
      <div className={styles.wordChipsPool}>
        {availableTokens.map((token) => (
          <Button
            key={token.id}
            className={styles.wordChip}
            onClick={() => handleSelectWord(token)}
            disabled={isVerified}
          >
            {token.word}
          </Button>
        ))}
      </div>

      {/* Verification Feedback */}
      {isVerified && (
        <Alert
          type={isCorrect ? 'success' : 'error'}
          showIcon
          message={isCorrect ? 'Отлично! Вы верно собрали предложение (+20 XP)' : 'Не совсем точно'}
          description={
            <div>
              <div className={styles.feedbackSentence}>
                <strong>Оригинал:</strong> {currentItem.sentence}
              </div>
              <div className={styles.feedbackTranslation}>
                <strong>Перевод:</strong> {currentItem.translation}
              </div>
            </div>
          }
          className={styles.feedbackBox}
        />
      )}

      {/* Action Buttons */}
      <div className={styles.controlsRow}>
        <Button
          size="large"
          icon={<ReloadOutlined />}
          onClick={() => {
            const tokens = tokenizeSentence(currentItem.sentence);
            const shuffled = shuffle(tokens).map((word, idx) => ({ id: idx, word }));
            setAvailableTokens(shuffled);
            setSelectedTokens([]);
            setIsVerified(false);
          }}
          disabled={isVerified}
          className={styles.resetBtn}
        >
          Сбросить
        </Button>

        {!isVerified ? (
          <Button
            type="primary"
            size="large"
            icon={<CheckOutlined />}
            onClick={handleVerify}
            disabled={selectedTokens.length === 0}
            className={styles.verifyBtn}
          >
            Проверить
          </Button>
        ) : (
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={handleNext}
            className={styles.nextBtn}
          >
            Следующее ➔
          </Button>
        )}
      </div>
    </div>
  );
};
