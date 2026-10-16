import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Progress, Tag, Space, Typography, message, Segmented, Tooltip } from 'antd';
import { 
  SoundOutlined, 
  SyncOutlined, 
  TrophyFilled,
  RedoOutlined,
  ThunderboltFilled,
  CheckCircleOutlined,
  ArrowRightOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { soundEffects } from '@/shared/lib/audio';
import { fireCelebration } from '@/shared/lib/confetti';
import { SRS_RATING_OPTIONS, SrsGrade, SRSEngine } from '@/shared/lib/srs';
import styles from './FlashcardDeck.module.scss';

const { Title, Text, Paragraph } = Typography;

export interface FlashcardItem {
  id: number | string;
  frontMain: string;
  frontPhonetic?: string;
  frontContext?: string;
  backMain: string;
  backDetail?: string;
  backGrammar?: string;
  level?: string;
  category?: string;
}

interface FlashcardDeckProps {
  items: FlashcardItem[];
  onFinish?: (knownCount: number, total: number) => void;
  onRefresh?: () => void;
  onNeedMore?: () => void;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  items,
  onFinish,
  onRefresh,
  onNeedMore,
}) => {
  const [roundMode, setRoundMode] = useState<'15' | '25' | 'all'>('15');
  const [roundCards, setRoundCards] = useState<FlashcardItem[]>([]);
  const [remainingPool, setRemainingPool] = useState<FlashcardItem[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [isFlipped, setIsFlipped] = useState(false);
  const [roundKnownCount, setRoundKnownCount] = useState(0);
  const [roundXpEarned, setRoundXpEarned] = useState(0);
  const [sessionKnownCount, setSessionKnownCount] = useState(0);
  const [sessionXpEarned, setSessionXpEarned] = useState(0);
  const [isRoundFinished, setIsRoundFinished] = useState(false);
  const [isDeckFinished, setIsDeckFinished] = useState(false);

  // Initialize or replenish cards
  useEffect(() => {
    if (!items || items.length === 0) return;

    if (roundCards.length === 0 && remainingPool.length === 0) {
      // First round initialization
      const targetSize = roundMode === '15' ? 15 : roundMode === '25' ? 25 : items.length;
      const initialBatch = items.slice(0, targetSize);
      const leftover = items.slice(targetSize);
      setRoundCards(initialBatch);
      setRemainingPool(leftover);
      setCurrentRoundIndex(0);
    } else {
      // Merge newly arrived items into remainingPool without duplicates
      setRemainingPool(prev => {
        const activeIds = new Set(roundCards.map(c => c.id));
        const poolIds = new Set(prev.map(c => c.id));
        const fresh = items.filter(c => !activeIds.has(c.id) && !poolIds.has(c.id));
        if (fresh.length === 0) return prev;
        return [...prev, ...fresh];
      });
    }
  }, [items, roundMode]);

  const currentItem = roundCards[currentRoundIndex];

  const handleFlip = useCallback(() => {
    soundEffects.playFx('flip');
    setIsFlipped(prev => !prev);
  }, []);

  const handleRating = useCallback((grade: SrsGrade) => {
    if (!currentItem) return;

    const option = SRS_RATING_OPTIONS.find(o => o.grade === grade);
    const xpReward = option ? option.xpReward : 10;

    // Trigger SuperMemo-2 server sync in background (immediately awards XP & emits xpEventBus)
    SRSEngine.syncReviewWithServer(currentItem.id, grade);

    // Update real-time XP counters
    setSessionXpEarned(prev => prev + xpReward);
    setRoundXpEarned(prev => prev + xpReward);

    if (grade === 1) {
      // Again: Re-insert into queue for this micro-round
      soundEffects.playWrong();
      message.info({ content: 'Карточка повторится в конце этого раунда', duration: 1.5 });
      setRoundCards(prev => [...prev, currentItem]);
    } else {
      // Successful recall
      if (grade === 4) {
        soundEffects.playCombo();
        message.success({ content: `+${xpReward} XP! Отличный результат`, duration: 1.5 });
      } else {
        soundEffects.playCorrect();
      }
      setRoundKnownCount(prev => prev + 1);
      setSessionKnownCount(prev => prev + 1);
    }

    // Auto-request replenishment if remaining queue is low
    const totalRemaining = remainingPool.length + (roundCards.length - (currentRoundIndex + 1));
    if (totalRemaining < 15) {
      onNeedMore?.();
    }

    // Check if current round completed
    if (currentRoundIndex + 1 >= roundCards.length) {
      soundEffects.playCombo();
      fireCelebration();
      setIsRoundFinished(true);

      if (remainingPool.length === 0) {
        setIsDeckFinished(true);
        onFinish?.(sessionKnownCount + (grade > 1 ? 1 : 0), items.length);
      }
    } else {
      setIsFlipped(false);
      setCurrentRoundIndex(prev => prev + 1);
    }
  }, [currentItem, currentRoundIndex, roundCards.length, remainingPool.length, sessionKnownCount, items.length, onFinish, onNeedMore]);

  // Round progression handlers
  const handleNextRound = useCallback(() => {
    const targetSize = roundMode === '15' ? 15 : roundMode === '25' ? 25 : remainingPool.length;
    const nextBatch = remainingPool.slice(0, targetSize);
    const nextPool = remainingPool.slice(targetSize);

    if (nextBatch.length === 0) {
      onNeedMore?.();
      onRefresh?.();
      return;
    }

    setRoundCards(nextBatch);
    setRemainingPool(nextPool);
    setCurrentRoundIndex(0);
    setRoundNumber(prev => prev + 1);
    setRoundKnownCount(0);
    setRoundXpEarned(0);
    setIsRoundFinished(false);
    setIsFlipped(false);

    if (nextPool.length < 15) {
      onNeedMore?.();
    }
  }, [roundMode, remainingPool, onNeedMore, onRefresh]);

  const handleRepeatRound = useCallback(() => {
    setCurrentRoundIndex(0);
    setRoundKnownCount(0);
    setRoundXpEarned(0);
    setIsRoundFinished(false);
    setIsFlipped(false);
  }, []);

  const handleRoundModeChange = useCallback((newMode: '15' | '25' | 'all') => {
    setRoundMode(newMode);
    if (newMode === 'all' && remainingPool.length > 0) {
      setRoundCards(prev => [...prev, ...remainingPool]);
      setRemainingPool([]);
      message.success('Все оставшиеся слова объединены в текущий раунд');
    }
  }, [remainingPool]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped) {
        if (e.key === '1') {
          e.preventDefault();
          handleRating(1);
        } else if (e.key === '2') {
          e.preventDefault();
          handleRating(2);
        } else if (e.key === '3') {
          e.preventDefault();
          handleRating(3);
        } else if (e.key === '4') {
          e.preventDefault();
          handleRating(4);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleRating, isFlipped]);

  if (!items || items.length === 0) {
    return (
      <Card className={styles.summaryCard}>
        <Title level={4}>Нет карточек для повторения</Title>
        <Text type="secondary">Выберите другой уровень или добавьте слова из словаря.</Text>
      </Card>
    );
  }

  // Celebratory Round Finished screen (after 15 cards)
  if (isRoundFinished) {
    const roundTotal = roundCards.length;
    const accuracy = roundTotal > 0 ? Math.round((roundKnownCount / roundTotal) * 100) : 100;
    const hasMoreRounds = remainingPool.length > 0;
    const nextRoundCount = Math.min(
      roundMode === '15' ? 15 : roundMode === '25' ? 25 : remainingPool.length,
      remainingPool.length
    );

    return (
      <Card className={styles.roundCompletionCard}>
        <TrophyFilled className={styles.roundCompletionTrophy} />
        <Title level={2}>
          {isDeckFinished ? 'Колода полностью завершена!' : `Раунд ${roundNumber} пройден!`}
        </Title>
        <Paragraph type="secondary" className={styles.summarySubtitle}>
          Отличный прогресс! Вы уверенно прошли {roundTotal} карточек ({accuracy}% усвоено).
          Весь полученный опыт уже начислен в ваш профиль.
        </Paragraph>

        {/* Round Stat Summary */}
        <div className={styles.roundStatsRow}>
          <div className={styles.roundStatItem}>
            <div className={`${styles.roundStatVal} ${styles.success}`}>
              {roundKnownCount} / {roundTotal}
            </div>
            <div className={styles.roundStatLabel}>Усвоено в раунде</div>
          </div>

          <div className={styles.roundStatItem}>
            <div className={`${styles.roundStatVal} ${styles.gold}`}>
              +{roundXpEarned} XP
            </div>
            <div className={styles.roundStatLabel}>Опыт за раунд</div>
          </div>

          <div className={styles.roundStatItem}>
            <div className={styles.roundStatVal}>
              +{sessionXpEarned} XP
            </div>
            <div className={styles.roundStatLabel}>Всего за сессию</div>
          </div>

          <div className={styles.roundStatItem}>
            <div className={styles.roundStatVal}>
              {remainingPool.length}
            </div>
            <div className={styles.roundStatLabel}>Слов в очереди</div>
          </div>
        </div>

        {/* Round Navigation Actions */}
        <Space size="middle" className={styles.summaryActions} wrap>
          {hasMoreRounds ? (
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={handleNextRound}
              className={styles.primaryActionBtn}
            >
              Изучить следующие {nextRoundCount} слов
            </Button>
          ) : (
            <Button
              type="primary"
              size="large"
              icon={<ThunderboltFilled className={styles.goldIcon} />}
              onClick={() => {
                onNeedMore?.();
                onRefresh?.();
                const targetSize = roundMode === '15' ? 15 : roundMode === '25' ? 25 : items.length;
                setRoundCards(items.slice(0, targetSize));
                setRemainingPool(items.slice(targetSize));
                setCurrentRoundIndex(0);
                setRoundNumber(1);
                setRoundKnownCount(0);
                setRoundXpEarned(0);
                setIsRoundFinished(false);
                setIsDeckFinished(false);
              }}
              className={styles.primaryActionBtn}
            >
              Изучить новые слова
            </Button>
          )}

          <Button
            size="large"
            icon={<RedoOutlined />}
            onClick={handleRepeatRound}
            className={styles.btnAction}
          >
            Повторить этот раунд
          </Button>

          <Button
            size="large"
            onClick={() => onFinish?.(sessionKnownCount, items.length)}
            className={styles.btnAction}
          >
            Завершить сессию
          </Button>
        </Space>
      </Card>
    );
  }

  const progressPercent = roundCards.length > 0 
    ? Math.round((currentRoundIndex / roundCards.length) * 100) 
    : 0;

  const totalInQueue = remainingPool.length + (roundCards.length - currentRoundIndex);

  return (
    <div className={styles.deckContainer}>
      {/* Top Header & Progress */}
      <div className={styles.topBar}>
        <div className={styles.topBarRow}>
          <div className={styles.roundTitleGroup}>
            <span className={styles.roundTitleText}>
              Раунд {roundNumber} • Карточка {currentRoundIndex + 1} из {roundCards.length}
            </span>
            <span className={styles.deckPoolHint}>
              (В очереди: {totalInQueue} слов)
            </span>
          </div>

          <div className={styles.topBarBadges}>
            {currentItem?.level && <Tag color="purple">{currentItem.level}</Tag>}
            {currentItem?.category && <Tag color="blue">{currentItem.category}</Tag>}
            <Tag color="success">Усвоено: {roundKnownCount}</Tag>

            <Tooltip title="Опыт начисляется мгновенно на каждом ответе. Вы можете выйти в любой момент — всё уже сохранено на балансе.">
              <Tag className={styles.xpSavedBadge}>
                <SafetyCertificateOutlined /> +{sessionXpEarned} XP сохранено
              </Tag>
            </Tooltip>

            <Segmented
              className={styles.modeSegmented}
              value={roundMode}
              onChange={(val) => handleRoundModeChange(val as '15' | '25' | 'all')}
              options={[
                { label: 'По 15', value: '15' },
                { label: 'По 25', value: '25' },
                { label: 'Все', value: 'all' },
              ]}
            />
          </div>
        </div>

        <Progress percent={progressPercent} strokeColor="#6366f1" showInfo={false} />

        <div className={styles.subBarInfo}>
          <span>Раунд {roundNumber}: {currentRoundIndex + 1} из {roundCards.length}</span>
          <span className={styles.safeExitHint}>
            <CheckCircleOutlined /> Опыт начисляется сразу • Безопасный выход в любой момент
          </span>
        </div>
      </div>

      {/* 3D Flip Card */}
      {currentItem && (
        <div className={styles.cardWrapper} onClick={handleFlip}>
          <div className={`${styles.cardInner} ${isFlipped ? styles.flipped : ''}`}>
            
            {/* Front Face */}
            <div className={styles.cardFront}>
              <div className={styles.cardHeader}>
                <Tag color="geekblue">Нажмите, чтобы перевернуть</Tag>
                <Button
                  type="text"
                  shape="circle"
                  icon={<SoundOutlined className={styles.soundIconFront} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEffects.speak(currentItem.frontMain);
                  }}
                  title="Озвучить"
                />
              </div>

              <div className={styles.cardContent}>
                <div className={styles.mainWord}>
                  {currentItem.frontMain}
                </div>
                {currentItem.frontPhonetic && (
                  <div className={styles.phonetic}>
                    {currentItem.frontPhonetic}
                  </div>
                )}
                {currentItem.frontContext && (
                  <div className={styles.contextSnippet}>
                    "{currentItem.frontContext}"
                  </div>
                )}
              </div>

              <div className={styles.flipHint}>
                🔄 Кликните по карточке или нажмите [Пробел] для переворота
              </div>
            </div>

            {/* Back Face */}
            <div className={styles.cardBack}>
              <div className={styles.cardHeader}>
                <Tag color="green">Перевод и разбор</Tag>
                <Button
                  type="text"
                  shape="circle"
                  icon={<SoundOutlined className={styles.soundIconBack} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    soundEffects.speak(currentItem.frontMain);
                  }}
                  title="Озвучить"
                />
              </div>

              <div className={styles.cardContent}>
                <div className={styles.translationText}>
                  {currentItem.backMain}
                </div>
                {currentItem.backDetail && (
                  <Paragraph className={styles.backDetailText}>
                    {currentItem.backDetail}
                  </Paragraph>
                )}
                {currentItem.backGrammar && (
                  <div className={styles.grammarNote}>
                    💡 <strong>Правило / Нюанс:</strong> {currentItem.backGrammar}
                  </div>
                )}
              </div>

              <div className={styles.flipHint}>
                Выберите интервал повторения карточки:
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Action Controls & 4 SRS Rating Buttons */}
      {!isFlipped ? (
        <div className={styles.actionControls}>
          <Button
            type="primary"
            size="large"
            icon={<SyncOutlined />}
            onClick={handleFlip}
            className={`${styles.btnAction} ${styles.flipBtn}`}
          >
            Показать ответ [Пробел]
          </Button>
        </div>
      ) : (
        <div>
          <div className={styles.srsRatingPanel}>
            {SRS_RATING_OPTIONS.map((opt) => (
              <button
                key={opt.grade}
                type="button"
                className={`${styles.srsRatingBtn} ${
                  opt.grade === 1 ? styles.again :
                  opt.grade === 2 ? styles.hard :
                  opt.grade === 3 ? styles.good : styles.easy
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRating(opt.grade);
                }}
              >
                <div className={styles.ratingHeader}>
                  <span className={styles.ratingTitle}>{opt.title}</span>
                  <span className={styles.shortcutBadge}>{opt.shortcut}</span>
                </div>
                <div className={styles.ratingSubTime}>{opt.subTime} (+{opt.xpReward} XP)</div>
              </button>
            ))}
          </div>

          <div className={`${styles.actionControls} ${styles.hideAnswerControls}`}>
            <Button
              type="text"
              size="middle"
              icon={<SyncOutlined />}
              onClick={handleFlip}
            >
              Скрыть ответ [Пробел]
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
