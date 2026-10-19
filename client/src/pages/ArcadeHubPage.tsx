import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Typography, Tag, Select, Alert } from 'antd';
import { 
  ThunderboltFilled, 
  PlayCircleFilled,
  BookOutlined
} from '@ant-design/icons';
import { Section } from '@/entities/section/model/types';
import { AuthUser } from '@/features/auth/ui/AuthModal';
import { sectionApi } from '@/entities/section/api/sectionApi';
import { dictionaryApi } from '@/entities/dictionary/api/dictionaryApi';
import styles from './ArcadeHubPage.module.scss';

const { Title, Paragraph } = Typography;

export type ArcadeMode = 'grammar' | 'quiz' | 'sprint' | 'builder' | 'cards' | 'audio';

interface ArcadeHubPageProps {
  sections?: Section[];
  initialCategory?: string;
  currentUser?: AuthUser | null;
  onRequireAuth?: () => void;
  onRefreshStats?: () => void;
}

export const ArcadeHubPage: React.FC<ArcadeHubPageProps> = ({
  sections: propSections,
  initialCategory,
  currentUser,
  onRequireAuth,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sections, setSections] = useState<Section[]>(propSections || []);
  const [selectedLevel, setSelectedLevel] = useState<string>(() => searchParams.get('level') || 'all');
  const [selectedSection, setSelectedSection] = useState<string>(() => searchParams.get('category') || initialCategory || 'all');
  const [totalInDb, setTotalInDb] = useState<number>(0);

  // Load sections if not passed via props
  useEffect(() => {
    if (!propSections || propSections.length === 0) {
      sectionApi.getSections().then(data => setSections(data)).catch(() => {});
    } else {
      setSections(propSections);
    }
  }, [propSections]);

  // Sync state with URL search params
  const handleLevelChange = (lvl: string) => {
    setSelectedLevel(lvl);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (lvl === 'all') next.delete('level');
      else next.set('level', lvl);
      return next;
    });
  };

  const handleSectionChange = (sec: string) => {
    setSelectedSection(sec);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (sec === 'all') next.delete('category');
      else next.set('category', sec);
      return next;
    });
  };

  useEffect(() => {
    let isCancelled = false;
    const fetchCount = async () => {
      try {
        const res = await dictionaryApi.getDictionary({
          level: selectedLevel,
          sectionId: selectedSection,
          limit: 1,
        });
        if (!isCancelled) {
          const dbCount = res.pagination?.totalInDb ?? res.pagination?.total ?? 0;
          setTotalInDb(dbCount);
        }
      } catch (err) {
        console.error('Failed to load count:', err);
      }
    };
    fetchCount();
    return () => { isCancelled = true; };
  }, [selectedLevel, selectedSection]);

  const handleStartMode = (modeId: ArcadeMode) => {
    if (!currentUser) {
      onRequireAuth?.();
      return;
    }
    const params = new URLSearchParams();
    if (selectedLevel !== 'all') params.set('level', selectedLevel);
    if (selectedSection !== 'all') params.set('category', selectedSection);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    navigate(`/trainers/${modeId}${queryString}`);
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
      badge: 'Восприятие на слух',
      badgeColor: 'green',
      description: 'Тренируйте восприятие речи носителей на слух. Слушайте озвучку фразы в естественном темпе и собирайте предложение из слов.',
      xpReward: '+25 XP за фразу'
    }
  ];

  const levels = ['all', 'A1', 'A2', 'B1', 'B2', 'C1'];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={2} className={styles.title}>
          🎮 Интерактивные тренажеры
        </Title>
        <Paragraph className={styles.subtitle}>
          Разносторонние форматы обучения: грамматика и контекст, словарные квизы, скоростные спринты, спеллинг, 3D карточки и аудирование.
        </Paragraph>
      </div>

      {!currentUser && (
        <Alert
          type="info"
          showIcon
          className={styles.guestAlert}
          message="Внимание: гостевой режим"
          description="Вы можете тренироваться прямо сейчас, но для сохранения прогресса, стриков и места в таблице лидеров войдите или создайте аккаунт."
          action={
            <Button size="small" type="primary" onClick={onRequireAuth}>
              Войти
            </Button>
          }
        />
      )}

      {/* Global Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.levelFilterGroup}>
            <span className={styles.filterLabel}>Уровень сложности (CEFR):</span>
            <div className={styles.levelButtonsGroup}>
              {levels.map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  className={`${styles.levelBtn} ${selectedLevel === lvl ? styles.activeLevelBtn : ''}`}
                  onClick={() => handleLevelChange(lvl)}
                >
                  {lvl === 'all' ? 'Все уровни' : lvl}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.dbCountWrapper}>
            <Tag color="purple" className={styles.dbCountTag}>
              📚 Слов в базе: <b>{totalInDb}</b>
            </Tag>
          </div>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.categoryFilterGroup}>
            <span className={styles.filterLabel}>Тематика и категория:</span>
            <Select
              value={selectedSection}
              onChange={handleSectionChange}
              className={styles.sectionSelect}
              options={[
                { label: '🌟 Все темы и категории', value: 'all' },
                ...sections.map(s => ({
                  label: s.title,
                  value: s.id,
                }))
              ]}
            />
          </div>
        </div>
      </div>

      {/* Trainers Cards Grid */}
      <div className={styles.cardsGrid}>
        {modes.map(m => (
          <Card key={m.id} className={styles.modeCard} hoverable>
            <div className={styles.modeCardBody}>
              <div className={styles.modeHeader}>
                <div className={styles.modeIcon}>{m.icon}</div>
                <div className={styles.modeHeaderInfo}>
                  <div className={styles.modeTitleRow}>
                    <Title level={4} className={styles.modeTitle}>
                      {m.title}
                    </Title>
                    <Tag color={m.badgeColor} className={styles.modeBadge}>
                      {m.badge}
                    </Tag>
                  </div>
                </div>
              </div>

              <Paragraph className={styles.modeDescription}>
                {m.description}
              </Paragraph>

              <div className={styles.modeFooter}>
                <Tag color="cyan" className={styles.xpTag}>
                  <ThunderboltFilled /> {m.xpReward}
                </Tag>

                <Button
                  type="primary"
                  icon={m.id === 'grammar' ? <BookOutlined /> : <PlayCircleFilled />}
                  onClick={() => handleStartMode(m.id)}
                  className={styles.playBtn}
                >
                  {m.id === 'grammar' ? 'Тренировать' : 'Играть'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
