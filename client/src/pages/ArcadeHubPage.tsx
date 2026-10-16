import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Typography, Button, Space, Select, Tag, Spin, message, Alert } from 'antd';
import { 
  ArrowLeftOutlined, 
  ThunderboltFilled, 
  FireFilled, 
  BookOutlined,
  PlayCircleFilled,
  CustomerServiceOutlined
} from '@ant-design/icons';
import { DictionaryItem } from '@/entities/dictionary/model/types';
import { Section } from '@/entities/section/model/types';
import { dictionaryApi } from '@/entities/dictionary/api/dictionaryApi';
import { sectionApi } from '@/entities/section/api/sectionApi';
import { VocabQuiz } from '@/widgets/vocab-quiz/ui/VocabQuiz';
import { SpeedSprint } from '@/widgets/speed-sprint/ui/SpeedSprint';
import { WordBuilder } from '@/widgets/word-builder/ui/WordBuilder';
import { FlashcardDeck } from '@/widgets/flashcard-deck/ui/FlashcardDeck';
import { AudioChallenge } from '@/widgets/audio-challenge/ui/AudioChallenge';
import { PracticePage } from '@/pages/PracticePage';
import styles from './ArcadeHubPage.module.scss';

const { Title, Text, Paragraph } = Typography;

type ArcadeMode = 'idle' | 'grammar' | 'quiz' | 'sprint' | 'builder' | 'cards' | 'audio';

interface ArcadeHubPageProps {
  onRefreshStats?: () => void;
  sections?: Section[];
  initialCategory?: string;
  initialMode?: ArcadeMode;
}

export const ArcadeHubPage: React.FC<ArcadeHubPageProps> = ({ 
  onRefreshStats,
  sections: propSections,
  initialCategory,
  initialMode = 'idle'
}) => {
  const [selectedMode, setSelectedMode] = useState<ArcadeMode>(initialMode);
  const [words, setWords] = useState<DictionaryItem[]>([]);
  const [sections, setSections] = useState<Section[]>(propSections || []);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedSection, setSelectedSection] = useState<string>(initialCategory || 'all');
  const [totalInDb, setTotalInDb] = useState<number>(0);
  const isReplenishingRef = useRef<boolean>(false);

  // Load sections if not passed via props
  useEffect(() => {
    if (!propSections || propSections.length === 0) {
      sectionApi.getSections().then(data => setSections(data)).catch(() => {});
    } else {
      setSections(propSections);
    }
  }, [propSections]);

  const handleNeedMoreWords = useCallback(async (count = 35): Promise<DictionaryItem[]> => {
    if (isReplenishingRef.current) return [];
    const targetLevel = selectedLevel !== 'all' ? selectedLevel : 'A1';
    const targetSection = selectedSection !== 'all' ? selectedSection : 'general';
    isReplenishingRef.current = true;
    try {
      const res = await dictionaryApi.generateWords(targetLevel, targetSection, count);
      if (res.success && res.data?.length > 0) {
        setWords(prev => {
          const existingIds = new Set(prev.map(w => w.id));
          const fresh = res.data.filter(w => !existingIds.has(w.id));
          return [...prev, ...fresh];
        });
        return res.data;
      }
      return [];
    } catch (err) {
      console.warn('Silent auto-replenishment note:', err);
      return [];
    } finally {
      isReplenishingRef.current = false;
    }
  }, [selectedLevel, selectedSection]);

  const fetchWords = async () => {
    setLoading(true);
    try {
      const res = await dictionaryApi.getDictionary({
        level: selectedLevel,
        sectionId: selectedSection,
        mode: 'practice',
        limit: 1000
      });
      setWords(res.data);
      const dbCount = res.pagination?.totalInDb ?? res.pagination?.total ?? res.data.length;
      setTotalInDb(dbCount);
      if (res.data.length < 30) {
        handleNeedMoreWords(35);
      }
      return res.data;
    } catch (err) {
      console.error('Failed to load arcade words:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, [selectedLevel, selectedSection]);

  const handleStartMode = async (modeId: ArcadeMode) => {
    if (modeId === 'grammar') {
      setSelectedMode('grammar');
      return;
    }

    if (words.length >= 2) {
      setSelectedMode(modeId);
      return;
    }

    // If words are still generating/loading or empty, trigger on-demand preparation
    const targetLevel = selectedLevel !== 'all' ? selectedLevel : 'A1';
    const targetSection = selectedSection !== 'all' ? selectedSection : 'general';
    message.loading({
      content: `Подготовка слов для уровня ${targetLevel}...`,
      key: 'start-mode-loading',
      duration: 10
    });
    setLoading(true);
    try {
      await dictionaryApi.generateWords(targetLevel, targetSection, 35);
      const freshWords = await fetchWords();
      if (freshWords.length > 0) {
        message.success({ content: 'Слова готовы! Запуск тренажера...', key: 'start-mode-loading', duration: 1.5 });
        setSelectedMode(modeId);
      } else {
        message.error({ content: 'Не удалось подготовить слова. Попробуйте еще раз.', key: 'start-mode-loading' });
      }
    } catch (err) {
      message.error({ content: 'Ошибка при подготовке слов к игре.', key: 'start-mode-loading' });
    } finally {
      setLoading(false);
    }
  };

  const handleGameComplete = async (xpEarned: number) => {
    try {
      if (xpEarned > 0) {
        onRefreshStats?.();
      }
      fetchWords();
    } catch (err) {
      console.error('Failed to update stats:', err);
    }
  };

  const modes = [
    {
      id: 'grammar' as ArcadeMode,
      icon: '📘',
      title: 'Грамматика и контекст',
      badge: 'Правила & Тесты',
      badgeColor: 'blue',
      description: 'Интерактивные упражнения на подстановку пропущенных слов, предлоги, времена глаголов и конструкции с подробным разбором грамматических правил.',
      xpReward: '+20 XP за задание'
    },
    {
      id: 'quiz' as ArcadeMode,
      icon: '🎯',
      title: 'Квиз: выбор 1 из 4',
      badge: 'Популярное',
      badgeColor: 'cyan',
      description: 'Классический тренажер запоминания слов. Показывается слово, выберите 1 из 4 вариантов перевода с моментальным разбором и произношением.',
      xpReward: '+15 XP за верный ответ'
    },
    {
      id: 'sprint' as ArcadeMode,
      icon: '⚡',
      title: 'Скоростной Спринт (60с)',
      badge: 'Динамично',
      badgeColor: 'volcano',
      description: 'Бешеная динамика на реакцию: за 60 секунд определите, верен ли перевод. Собирайте комбо-серии x2, x3, x4 и бейте рекорды скорости!',
      xpReward: 'До +150 XP за игру'
    },
    {
      id: 'builder' as ArcadeMode,
      icon: '🧩',
      title: 'Конструктор слов (Спеллинг)',
      badge: 'Правописание',
      badgeColor: 'purple',
      description: 'Изучайте правильное написание английских слов по буквам. Кликайте по плиткам или печатайте на клавиатуре с поддержкой подсказок.',
      xpReward: '+20 XP за слово'
    },
    {
      id: 'cards' as ArcadeMode,
      icon: '🗂️',
      title: '3D Флеш-карточки (SRS)',
      badge: 'Интервально',
      badgeColor: 'geekblue',
      description: 'Тренировка памяти по алгоритму интервальных повторений. 3D переворот карточки, примеры в контексте, транскрипция и грамматические нюансы.',
      xpReward: '+10 XP за карточку'
    },
    {
      id: 'audio' as ArcadeMode,
      icon: '🎧',
      title: 'Аудирование и диктант',
      badge: 'На слух',
      badgeColor: 'green',
      description: 'Восприятие беглой английской речи на слух с нормальной (1.0x) и замедленной (0.75x) скоростью. Соберите услышанную фразу из слов.',
      xpReward: '+20 XP за фразу'
    }
  ];

  return (
    <div className={styles.container}>
      {selectedMode === 'idle' ? (
        <>
          <div className={styles.header}>
            <Title level={2} className={styles.title}>
              🎮 Интерактивные тренажеры
            </Title>
            <Paragraph className={styles.subtitle}>
              Разносторонние форматы обучения: грамматика и контекст, словарные квизы, скоростные спринты, спеллинг, 3D карточки и аудирование.
            </Paragraph>
          </div>

          {/* Filter Bar */}
          <div className={styles.filterBar}>
            <Space wrap size="middle">
              <Space>
                <Text strong>Уровень CEFR:</Text>
                <Select
                  value={selectedLevel}
                  onChange={setSelectedLevel}
                  className={styles.levelSelect}
                  options={[
                    { label: 'Все уровни', value: 'all' },
                    { label: 'A1 (Beginner)', value: 'A1' },
                    { label: 'A2 (Elementary)', value: 'A2' },
                    { label: 'B1 (Intermediate)', value: 'B1' },
                    { label: 'B2 (Upper-Inter.)', value: 'B2' },
                    { label: 'C1 (Advanced)', value: 'C1' },
                  ]}
                />
              </Space>

              <Space>
                <Text strong>Тематика:</Text>
                <Select
                  value={selectedSection}
                  onChange={setSelectedSection}
                  className={styles.sectionSelect}
                  options={[
                    { label: 'Все темы и категории', value: 'all' },
                    ...(sections.length > 0
                      ? sections.map(s => ({ label: s.title, value: s.id }))
                      : [
                          { label: 'Грамматика и конструкции', value: 'grammar' },
                          { label: 'Деловой английский', value: 'business' },
                          { label: 'Фразовые и идиомы', value: 'phrasal_idioms' },
                          { label: 'Разговорный и сленг', value: 'conversational' },
                          { label: 'IT и разработка', value: 'tech_it' },
                          { label: 'Путешествия', value: 'travel' },
                          { label: 'IELTS / TOEFL', value: 'ielts_toefl' },
                        ])
                  ]}
                />
              </Space>
            </Space>

            <Space wrap align="center">
              <Tag color="purple" className={styles.dbCountTag}>
                Доступно слов в базе: {totalInDb || words.length}
              </Tag>
            </Space>
          </div>

          {loading ? (
            <div className={styles.loadingContainer}>
              <Spin size="large" />
              <div className={styles.loadingMessage}>
                ⚡ Загрузка слов для уровня <b>{selectedLevel === 'all' ? 'Все уровни' : selectedLevel}</b>...
              </div>
            </div>
          ) : (
            <div className={styles.cardsGrid}>
              {modes.map((m) => (
                <Card key={m.id} className={styles.modeCard}>
                  <div>
                    <div className={styles.modeHeader}>
                      <div className={styles.modeIcon}>
                        {m.icon}
                      </div>
                      <div>
                        <Title level={4} className={styles.modeTitle}>
                          {m.title}
                        </Title>
                        <Tag color={m.badgeColor} className={styles.modeBadge}>
                          {m.badge}
                        </Tag>
                      </div>
                    </div>

                    <Paragraph className={styles.modeDescription}>
                      {m.description}
                    </Paragraph>
                  </div>

                  <div className={styles.modeFooter}>
                    <Tag color="cyan">
                      <ThunderboltFilled /> {m.xpReward}
                    </Tag>

                    <Button
                      type="primary"
                      icon={m.id === 'grammar' ? <BookOutlined /> : <PlayCircleFilled />}
                      onClick={() => handleStartMode(m.id)}
                      loading={loading && selectedMode === m.id}
                    >
                      {m.id === 'grammar' ? 'Тренировать' : 'Играть'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className={styles.activeGameArea}>
          {selectedMode === 'grammar' ? (
            <PracticePage
              allSections={sections}
              initialSectionId={selectedSection !== 'all' ? selectedSection : 'grammar'}
              initialLevel={selectedLevel !== 'all' ? selectedLevel : 'B1'}
              onBack={() => setSelectedMode('idle')}
              onRefreshStats={() => onRefreshStats?.()}
            />
          ) : (
            <>
              <div className={styles.backBtnRow}>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => {
                    setSelectedMode('idle');
                    onRefreshStats?.();
                  }}
                  size="large"
                >
                  Назад ко всем тренажерам
                </Button>
              </div>

              {selectedMode === 'quiz' && (
                <VocabQuiz
                  words={words}
                  onComplete={(score, total, xp) => handleGameComplete(xp)}
                  onClose={() => setSelectedMode('idle')}
                  onNeedMore={() => handleNeedMoreWords(35)}
                />
              )}

              {selectedMode === 'sprint' && (
                <SpeedSprint
                  words={words}
                  onComplete={(score, combo, xp) => handleGameComplete(xp)}
                  onClose={() => setSelectedMode('idle')}
                  onNeedMore={() => handleNeedMoreWords(35)}
                />
              )}

              {selectedMode === 'builder' && (
                <WordBuilder
                  words={words}
                  onComplete={(score, total, xp) => handleGameComplete(xp)}
                  onClose={() => setSelectedMode('idle')}
                  onNeedMore={() => handleNeedMoreWords(35)}
                />
              )}

              {selectedMode === 'cards' && (
                <FlashcardDeck
                  items={words.map(w => ({
                    id: w.id,
                    frontMain: w.word,
                    frontPhonetic: w.transcription,
                    frontContext: w.example_sentence,
                    backMain: w.translation,
                    backDetail: w.definition,
                    backGrammar: w.example_translation,
                    level: w.level,
                    category: w.section_id
                  }))}
                  onFinish={() => handleGameComplete(50)}
                  onRefresh={fetchWords}
                  onNeedMore={() => handleNeedMoreWords(35)}
                />
              )}

              {selectedMode === 'audio' && (
                <AudioChallenge
                  items={words.filter(w => !!w.example_sentence).map(w => ({
                    id: w.id,
                    sentence: w.example_sentence || w.word,
                    translation: w.example_translation || w.translation,
                    hint: w.definition,
                    level: w.level
                  }))}
                  onComplete={(score) => handleGameComplete(score)}
                  onRefresh={fetchWords}
                  onNeedMore={() => handleNeedMoreWords(35)}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
