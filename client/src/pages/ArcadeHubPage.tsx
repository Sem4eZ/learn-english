import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Button, Typography, Tag, Select, Alert, Spin, message } from 'antd';
import { 
  ThunderboltFilled, 
  PlayCircleFilled,
  BookOutlined,
  LoadingOutlined,
  WarningOutlined
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
  onRefreshStats,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [sections, setSections] = useState<Section[]>(propSections || []);
  const [selectedLevel, setSelectedLevel] = useState<string>(() => searchParams.get('level') || 'all');
  const [selectedSection, setSelectedSection] = useState<string>(() => searchParams.get('category') || initialCategory || 'all');
  const [totalInDb, setTotalInDb] = useState<number>(0);
  const [isLoadingCount, setIsLoadingCount] = useState<boolean>(true);
  const [isGeneratingWords, setIsGeneratingWords] = useState<boolean>(false);
  const activeRequestIdRef = useRef<number>(0);

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
    if (isGeneratingWords) return;
    setSelectedLevel(lvl);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (lvl === 'all') next.delete('level');
      else next.set('level', lvl);
      return next;
    });
  };

  const handleSectionChange = (sec: string) => {
    if (isGeneratingWords) return;
    setSelectedSection(sec);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (sec === 'all') next.delete('category');
      else next.set('category', sec);
      return next;
    });
  };

  // Re-fetch dictionary words count on level or category change with race condition elimination
  useEffect(() => {
    const requestId = ++activeRequestIdRef.current;
    setIsLoadingCount(true);

    dictionaryApi.getDictionary({
      level: selectedLevel,
      sectionId: selectedSection,
      limit: 1,
    })
      .then(res => {
        if (requestId === activeRequestIdRef.current) {
          const dbCount = res.pagination?.totalInDb ?? res.pagination?.total ?? 0;
          setTotalInDb(dbCount);
          setIsLoadingCount(false);
        }
      })
      .catch(err => {
        console.error('Failed to load count:', err);
        if (requestId === activeRequestIdRef.current) {
          setTotalInDb(0);
          setIsLoadingCount(false);
        }
      });
  }, [selectedLevel, selectedSection]);

  const handleStartMode = (modeId: ArcadeMode) => {
    // 1. Block entry if level verification or loading is in progress
    if (isLoadingCount) {
      message.loading({ content: 'Подождите, идет проверка и подготовка уровня...', key: 'hub-level-loading', duration: 2 });
      return;
    }

    // 2. Block entry to vocabulary modes if database has 0 words for selected level
    if (modeId !== 'grammar' && totalInDb === 0) {
      message.warning(`В базе нет слов для уровня ${selectedLevel === 'all' ? 'Все уровни' : selectedLevel}. Сгенерируйте слова, чтобы начать.`);
      return;
    }

    // 3. Check authentication
    if (!currentUser) {
      onRequireAuth?.();
      return;
    }

    // 4. Safe navigation to the selected trainer
    const params = new URLSearchParams();
    if (selectedLevel !== 'all') params.set('level', selectedLevel);
    if (selectedSection !== 'all') params.set('category', selectedSection);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    navigate(`/trainers/${modeId}${queryString}`);
  };

  const handleGenerateWords = async () => {
    if (!currentUser) {
      message.warning('Для генерации слов войдите или зарегистрируйтесь');
      onRequireAuth?.();
      return;
    }

    setIsGeneratingWords(true);
    const hideLoading = message.loading('Генерация стартового набора слов через ИИ (Gemini)...', 0);
    try {
      const lvl = selectedLevel === 'all' ? 'A1' : selectedLevel;
      const sec = selectedSection === 'all' ? 'general' : selectedSection;
      const res = await dictionaryApi.generateWords(lvl, sec, 50);
      hideLoading();
      if (res.success && res.data?.length > 0) {
        message.success(res.message || `Добавлено ${res.data.length} новых слов для уровня ${lvl}!`);
        // Re-check count
        const countRes = await dictionaryApi.getDictionary({
          level: selectedLevel,
          sectionId: selectedSection,
          limit: 1,
        });
        const dbCount = countRes.pagination?.totalInDb ?? countRes.pagination?.total ?? res.data.length;
        setTotalInDb(dbCount);
        onRefreshStats?.();
      } else {
        message.info('Слова уже существуют или не удалось создать новые');
      }
    } catch (err) {
      hideLoading();
      console.error('Failed to generate words from hub:', err);
      message.error('Ошибка генерации слов. Попробуйте еще раз через пару секунд.');
    } finally {
      setIsGeneratingWords(false);
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
              {levels.map(lvl => {
                const isActive = selectedLevel === lvl;
                const isLoadingThis = isLoadingCount && isActive;
                return (
                  <button
                    key={lvl}
                    type="button"
                    className={`${styles.levelBtn} ${isActive ? styles.activeLevelBtn : ''} ${isLoadingThis ? styles.loadingLevelBtn : ''}`}
                    onClick={() => handleLevelChange(lvl)}
                    disabled={isGeneratingWords}
                    data-testid={`level-btn-${lvl}`}
                  >
                    {isLoadingThis && <span aria-hidden="true" style={{ marginRight: 6 }}><LoadingOutlined spin /></span>}{lvl === 'all' ? 'Все уровни' : lvl}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.dbCountWrapper}>
            {isLoadingCount ? (
              <Tag color="purple" className={styles.dbCountTag} data-testid="db-count-tag">
                <LoadingOutlined spin style={{ marginRight: 6 }} /> Проверка базы...
              </Tag>
            ) : totalInDb === 0 ? (
              <Tag color="volcano" className={styles.dbCountTag} data-testid="db-count-tag">
                <WarningOutlined style={{ marginRight: 6 }} /> Слов в базе: <b>0</b>
              </Tag>
            ) : (
              <Tag color="purple" className={styles.dbCountTag} data-testid="db-count-tag">
                📚 Слов в базе: <b>{totalInDb}</b>
              </Tag>
            )}
          </div>
        </div>

        <div className={styles.filterRow}>
          <div className={styles.categoryFilterGroup}>
            <span className={styles.filterLabel}>Тематика и категория:</span>
            <Select
              value={selectedSection}
              onChange={handleSectionChange}
              disabled={isGeneratingWords}
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

      {/* Loading banner on level/category switch */}
      {isLoadingCount && (
        <div className={styles.loadingBanner} data-testid="hub-loading-banner">
          <Spin size="small" />
          <span>
            Синхронизация и проверка доступных слов для уровня <b>{selectedLevel === 'all' ? 'Все уровни' : selectedLevel}</b>...
          </span>
        </div>
      )}

      {/* Empty words alert with one-click AI generation */}
      {!isLoadingCount && totalInDb === 0 && (
        <Alert
          type="warning"
          showIcon
          className={styles.emptyWordsAlert}
          data-testid="hub-empty-words-alert"
          message={`В базе пока нет слов для уровня ${selectedLevel === 'all' ? 'Все уровни' : selectedLevel}`}
          description="Словарные тренажеры временно заблокированы, так как для данного уровня нет слов. Нажмите кнопку ниже, чтобы сгенерировать стартовый набор слов через нейросеть."
          action={
            <Button
              type="primary"
              icon={<ThunderboltFilled />}
              loading={isGeneratingWords}
              onClick={handleGenerateWords}
              data-testid="hub-generate-words-btn"
            >
              Сгенерировать слова (ИИ)
            </Button>
          }
        />
      )}

      {/* Trainers Cards Grid */}
      <div className={styles.cardsGrid}>
        {modes.map(m => {
          const isVocab = m.id !== 'grammar';
          const isBlocked = isLoadingCount || (isVocab && totalInDb === 0);
          const btnTitle = isLoadingCount
            ? 'Идет проверка уровня...'
            : isVocab && totalInDb === 0
              ? `В базе нет слов для уровня ${selectedLevel === 'all' ? 'Все уровни' : selectedLevel}. Сгенерируйте слова выше.`
              : undefined;

          return (
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
                    loading={isLoadingCount}
                    disabled={isBlocked}
                    title={btnTitle}
                    data-testid={`play-btn-${m.id}`}
                  >
                    {m.id === 'grammar'
                      ? 'Тренировать'
                      : !isLoadingCount && totalInDb === 0
                        ? 'Нет слов'
                        : 'Играть'}
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
