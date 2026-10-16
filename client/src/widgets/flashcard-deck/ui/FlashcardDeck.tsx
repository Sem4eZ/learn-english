import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Progress, Tag, Space, Typography, message } from 'antd';
import { 
  SoundOutlined, 
  SyncOutlined, 
  TrophyFilled,
  RedoOutlined
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
  const [deck, setDeck] = useState<FlashcardItem[]>(items);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  const [totalXpEarned, setTotalXpEarned] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    setDeck(prevDeck => {
      if (prevDeck.length === 0) {
        return items;
      }
      const existingIds = new Set(prevDeck.map(x => x.id));
      const newItems = items.filter(x => !existingIds.has(x.id));
      if (newItems.length === 0) return prevDeck;
      return [...prevDeck, ...newItems];
    });
  }, [items]);

  const currentItem = deck[currentIndex];

  const handleFlip = useCallback(() => {
    soundEffects.playFx('flip');
    setIsFlipped(prev => !prev);
  }, []);

  const handleRating = useCallback((grade: SrsGrade) => {
    if (!currentItem) return;

    const option = SRS_RATING_OPTIONS.find(o => o.grade === grade);
    const xpReward = option ? option.xpReward : 10;

    // Trigger SuperMemo-2 server sync in background
    SRSEngine.syncReviewWithServer(currentItem.id, grade);

    if (grade === 1) {
      // Again: Re-insert into queue for this session
      soundEffects.playWrong();
      message.info({ content: 'Карточка повторится в текущей сессии', duration: 1.5 });
      setDeck(prev => [...prev, currentItem]);
    } else {
      // Successful recall
      if (grade === 4) {
        soundEffects.playCombo();
        message.success({ content: `+${xpReward} XP! Отличный результат`, duration: 1.5 });
      } else {
        soundEffects.playCorrect();
      }
      setKnownCount(prev => prev + 1);
    }

    setTotalXpEarned(prev => prev + xpReward);

    const remainingCards = deck.length - (currentIndex + 1);
    if (remainingCards < 15) {
      onNeedMore?.();
    }

    if (currentIndex + 1 >= deck.length) {
      fireCelebration();
      setIsFinished(true);
      onFinish?.(knownCount + (grade > 1 ? 1 : 0), items.length);
    } else {
      setIsFlipped(false);
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentItem, currentIndex, deck.length, knownCount, items.length, onFinish, onNeedMore]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
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

  if (isFinished) {
    const accuracy = Math.round((knownCount / items.length) * 100);
    return (
      <Card className={styles.summaryCard}>
        <TrophyFilled className={styles.summaryTrophy} />
        <Title level={2}>Колода пройдена!</Title>
        <Paragraph type="secondary" className={styles.summarySubtitle}>
          Вы отлично потренировали интервальные повторения: усвоено {knownCount} из {items.length} слов ({accuracy}%).
          Заработано <strong>+{totalXpEarned} XP</strong>.
        </Paragraph>
        <Space size="middle" className={styles.summaryActions}>
          <Button
            type="primary"
            size="large"
            icon={<RedoOutlined />}
            onClick={() => {
              setDeck(items);
              setCurrentIndex(0);
              setIsFlipped(false);
              setKnownCount(0);
              setTotalXpEarned(0);
              setIsFinished(false);
            }}
            className={styles.btnAction}
          >
            Повторить колоду
          </Button>
          <Button
            size="large"
            onClick={() => {
              onNeedMore?.();
              onRefresh?.();
              setDeck(items);
              setCurrentIndex(0);
              setIsFlipped(false);
              setKnownCount(0);
              setTotalXpEarned(0);
              setIsFinished(false);
            }}
            className={styles.btnAction}
          >
            Следующие карточки
          </Button>
        </Space>
      </Card>
    );
  }

  const progressPercent = Math.round(((currentIndex) / deck.length) * 100);

  return (
    <div className={styles.deckContainer}>
      {/* Top progress bar */}
      <div>
        <div className={styles.topBar}>
          <Text type="secondary" strong>
            Карточка {currentIndex + 1} из {deck.length}
          </Text>
          <Space>
            {currentItem.level && <Tag color="purple">{currentItem.level}</Tag>}
            {currentItem.category && <Tag color="blue">{currentItem.category}</Tag>}
            <Tag color="success">Усвоено: {knownCount}</Tag>
            <Tag color="gold">+{totalXpEarned} XP</Tag>
          </Space>
        </div>
        <Progress percent={progressPercent} strokeColor="#6366f1" showInfo={false} />
      </div>

      {/* 3D Flip Card */}
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

      {/* Action Controls & 4 SRS Rating Buttons */}
      {!isFlipped ? (
        <div className={styles.actionControls}>
          <Button
            type="primary"
            size="large"
            icon={<SyncOutlined />}
            onClick={handleFlip}
            className={styles.btnAction}
            style={{ minWidth: 220 }}
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
                <div className={styles.ratingSubTime}>{opt.subTime}</div>
              </button>
            ))}
          </div>

          <div className={styles.actionControls} style={{ marginTop: 12 }}>
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
