import React, { useState, useEffect } from 'react';
import { Card, Button, Progress, Tag, Space, Typography } from 'antd';
import { 
  SoundOutlined, 
  CheckOutlined, 
  BulbOutlined, 
  UndoOutlined, 
  ArrowRightOutlined, 
  TrophyFilled,
  RedoOutlined,
  ThunderboltFilled
} from '@ant-design/icons';
import { DictionaryItem } from '@/entities/dictionary/model/types';
import { soundEffects } from '@/shared/lib/audio';
import { fireCelebration } from '@/shared/lib/confetti';
import styles from './WordBuilder.module.scss';

const { Title, Text, Paragraph } = Typography;

export interface WordBuilderProps {
  words: DictionaryItem[];
  onComplete?: (score: number, total: number, xpEarned: number) => void;
  onClose?: () => void;
  onNeedMore?: () => void;
}

interface LetterTile {
  id: string;
  char: string;
  used: boolean;
}

export const WordBuilder: React.FC<WordBuilderProps> = ({
  words,
  onComplete,
  onClose,
  onNeedMore
}) => {
  const [exerciseWords, setExerciseWords] = useState<DictionaryItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [scrambledLetters, setScrambledLetters] = useState<LetterTile[]>([]);
  const [assembledLetters, setAssembledLetters] = useState<LetterTile[]>([]);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const usedWordIdsRef = React.useRef<Set<number>>(new Set());

  const pickBatchWords = (wordList: DictionaryItem[], preferUnused = true) => {
    let suitable = wordList.filter(w => !w.word.includes(' ') && w.word.length <= 14);
    if (preferUnused) {
      const unused = suitable.filter(w => !usedWordIdsRef.current.has(w.id));
      if (unused.length >= 5) {
        suitable = unused;
      } else {
        usedWordIdsRef.current.clear();
      }
    }

    if (suitable.length < 15) {
      onNeedMore?.();
    }

    const shuffled = [...suitable].sort(() => 0.5 - Math.random());
    const finalWords = shuffled.slice(0, 10);
    finalWords.forEach(w => usedWordIdsRef.current.add(w.id));
    return finalWords.length >= 3 ? finalWords : wordList.slice(0, 8);
  };

  // Initialize
  useEffect(() => {
    if (words.length > 0 && exerciseWords.length === 0) {
      const batch = pickBatchWords(words, true);
      setExerciseWords(batch);
      setCurrentIndex(0);
      setScore(0);
      setIsFinished(false);
      setupWord(batch[0]);
    }
  }, [words]);

  const setupWord = (targetItem?: DictionaryItem) => {
    if (!targetItem) return;
    const cleanChars = targetItem.word.toLowerCase().replace(/[^a-z-]/g, '').split('');
    const tiles: LetterTile[] = cleanChars.map((char, idx) => ({
      id: `${char}-${idx}-${Math.random()}`,
      char,
      used: false
    }));

    // Scramble tiles
    const scrambled = [...tiles].sort(() => 0.5 - Math.random());
    setScrambledLetters(scrambled);
    setAssembledLetters([]);
    setIsCorrect(null);

    // Speak word
    soundEffects.speak(targetItem.word);
  };

  const currentWord = exerciseWords[currentIndex];

  const handleSelectTile = (tile: LetterTile) => {
    if (tile.used || isCorrect === true) return;

    soundEffects.playFx('flip');
    const updatedPool = scrambledLetters.map(t => t.id === tile.id ? { ...t, used: true } : t);
    const updatedAssembled = [...assembledLetters, tile];

    setScrambledLetters(updatedPool);
    setAssembledLetters(updatedAssembled);

    checkWord(updatedAssembled);
  };

  const handleRemoveTile = (tile: LetterTile, index: number) => {
    if (isCorrect === true) return;

    soundEffects.playFx('flip');
    const updatedAssembled = assembledLetters.filter((_, i) => i !== index);
    const updatedPool = scrambledLetters.map(t => t.id === tile.id ? { ...t, used: false } : t);

    setAssembledLetters(updatedAssembled);
    setScrambledLetters(updatedPool);
    setIsCorrect(null);
  };

  const handleReset = () => {
    if (isCorrect === true) return;
    setAssembledLetters([]);
    setScrambledLetters(prev => prev.map(t => ({ ...t, used: false })));
    setIsCorrect(null);
  };

  const handleHint = () => {
    if (!currentWord || isCorrect === true) return;
    const cleanTarget = currentWord.word.toLowerCase().replace(/[^a-z-]/g, '');
    const currentBuiltLength = assembledLetters.length;

    if (currentBuiltLength >= cleanTarget.length) return;

    const nextExpectedChar = cleanTarget[currentBuiltLength];
    const availableTile = scrambledLetters.find(t => t.char === nextExpectedChar && !t.used);

    if (availableTile) {
      setHintsUsed(prev => prev + 1);
      handleSelectTile(availableTile);
    }
  };

  const checkWord = (assembled: LetterTile[]) => {
    if (!currentWord) return;
    const cleanTarget = currentWord.word.toLowerCase().replace(/[^a-z-]/g, '');
    const built = assembled.map(t => t.char).join('');

    if (built.length === cleanTarget.length) {
      if (built === cleanTarget) {
        soundEffects.playCorrect();
        setIsCorrect(true);
        setScore(prev => prev + 1);
      } else {
        soundEffects.playWrong();
        setIsCorrect(false);
      }
    }
  };

  // Keyboard typing listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished || isCorrect === true || !currentWord) return;

      if (e.key === 'Backspace') {
        if (assembledLetters.length > 0) {
          const lastIdx = assembledLetters.length - 1;
          handleRemoveTile(assembledLetters[lastIdx], lastIdx);
        }
        return;
      }

      const keyChar = e.key.toLowerCase();
      if (/^[a-z-]$/.test(keyChar)) {
        const matchingTile = scrambledLetters.find(t => t.char === keyChar && !t.used);
        if (matchingTile) {
          handleSelectTile(matchingTile);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrambledLetters, assembledLetters, isCorrect, isFinished, currentWord]);

  const handleNextWord = () => {
    const remaining = exerciseWords.length - (currentIndex + 1);
    if (remaining < 4) {
      onNeedMore?.();
    }

    if (currentIndex + 1 >= exerciseWords.length) {
      fireCelebration();
      setIsFinished(true);
      const xpEarned = score * 20;
      onComplete?.(score, exerciseWords.length, xpEarned);
    } else {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setupWord(exerciseWords[nextIdx]);
    }
  };

  if (!words || words.length === 0) {
    return (
      <Card className={styles.summaryCard}>
        <Title level={4}>Слова не найдены</Title>
        <Text type="secondary">Добавьте слова в словарь для тренировки конструктора.</Text>
      </Card>
    );
  }

  if (isFinished) {
    const xpEarned = score * 20;

    return (
      <Card className={styles.summaryCard}>
        <TrophyFilled className={styles.summaryTrophy} />
        <Title level={2}>Спеллинг-тренировка завершена!</Title>
        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#6366f1', margin: '12px 0' }}>
          {score} / {exerciseWords.length} слов
        </div>
        <Paragraph type="secondary">
          Использовано подсказок: {hintsUsed}
        </Paragraph>
        <Paragraph>
          <Tag color="cyan" style={{ fontSize: '1.1rem', padding: '6px 16px' }}>
            <ThunderboltFilled /> +{xpEarned} XP получено
          </Tag>
        </Paragraph>

        <Space size="middle" style={{ marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={() => {
              const batch = pickBatchWords(words, true);
              setExerciseWords(batch);
              setCurrentIndex(0);
              setScore(0);
              setHintsUsed(0);
              setIsFinished(false);
              setupWord(batch[0]);
            }}
          >
            Следующие 10 слов
          </Button>

          <Button
            size="large"
            icon={<RedoOutlined />}
            onClick={() => {
              setCurrentIndex(0);
              setScore(0);
              setHintsUsed(0);
              setIsFinished(false);
              setupWord(exerciseWords[0]);
            }}
          >
            Собрать снова
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

  if (!currentWord) return null;

  const progressPercent = Math.round(((currentIndex) / exerciseWords.length) * 100);

  return (
    <div className={styles.builderContainer}>
      {/* Top Bar with counter and XP */}
      <div>
        <div className={styles.topBar}>
          <Text type="secondary" strong>
            Слово {currentIndex + 1} из {exerciseWords.length}
          </Text>

          <Space>
            <Tag color="purple">{currentWord.level || 'B1'}</Tag>
            <Tag color="cyan">
              <ThunderboltFilled /> {score * 20} XP
            </Tag>
          </Space>
        </div>
        <Progress percent={progressPercent} strokeColor="#6366f1" showInfo={false} />
      </div>

      {/* Target Word Translation Card */}
      <Card className={styles.targetCard}>
        <div className={styles.meaningText}>
          {currentWord.translation}
        </div>

        {currentWord.definition && (
          <div className={styles.contextSub}>
            "{currentWord.definition}"
          </div>
        )}

        <Button
          type="primary"
          shape="circle"
          icon={<SoundOutlined />}
          onClick={() => soundEffects.speak(currentWord.word)}
          title="Прослушать произношение"
          style={{ marginTop: 4 }}
        />
      </Card>

      {/* Assembled Word Slot Area */}
      <div 
        className={`${styles.assemblyArea} ${
          isCorrect === true ? styles.correct : isCorrect === false ? styles.wrong : ''
        }`}
      >
        {assembledLetters.length === 0 ? (
          <div className={styles.emptySlotHint}>
            Кликайте по плиткам внизу или набирайте слово на клавиатуре...
          </div>
        ) : (
          assembledLetters.map((tile, idx) => (
            <Button
              key={tile.id}
              className={styles.assembledTile}
              onClick={() => handleRemoveTile(tile, idx)}
              disabled={isCorrect === true}
            >
              {tile.char}
            </Button>
          ))
        )}
      </div>

      {/* Scrambled Available Letters Pool */}
      <div className={styles.scrambledPool}>
        {scrambledLetters.map((tile) => (
          <Button
            key={tile.id}
            className={styles.availableTile}
            onClick={() => handleSelectTile(tile)}
            disabled={tile.used || isCorrect === true}
          >
            {tile.char}
          </Button>
        ))}
      </div>

      {/* Action Controls */}
      <div className={styles.actionsRow}>
        <Space>
          <Button
            icon={<BulbOutlined />}
            onClick={handleHint}
            disabled={isCorrect === true}
          >
            Подсказка
          </Button>

          <Button
            icon={<UndoOutlined />}
            onClick={handleReset}
            disabled={isCorrect === true || assembledLetters.length === 0}
          >
            Сбросить
          </Button>
        </Space>

        {isCorrect === true && (
          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={handleNextWord}
            style={{ background: '#10b981', borderColor: '#10b981' }}
          >
            {currentIndex + 1 >= exerciseWords.length ? 'Завершить' : 'Следующее слово'}
          </Button>
        )}
      </div>
    </div>
  );
};
