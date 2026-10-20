import React, { useState, useMemo } from 'react';
import { Card, Progress, Typography, Table, Tag, Button, Tooltip, Tabs, Segmented, Input, Pagination } from 'antd';
import {
  TrophyFilled,
  FireFilled,
  ThunderboltFilled,
  CheckCircleOutlined,
  ReloadOutlined,
  ReadOutlined,
  FormOutlined,
  RocketOutlined,
  BookOutlined,
  AimOutlined,
  AppstoreOutlined,
  CrownOutlined,
  FireOutlined,
  TrophyOutlined,
  RiseOutlined,
  CheckOutlined,
  LockOutlined,
  SoundOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { UserStats } from '@/entities/user/model/types';
import styles from './StatsOverview.module.scss';

const { Title, Text } = Typography;

interface StatsOverviewProps {
  stats: UserStats | null;
  onRefreshStats?: () => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, onRefreshStats }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [badgeSearch, setBadgeSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 18;

  if (!stats) return null;

  const level = stats.level || 1;
  const rankTitle = stats.rankTitle || 'Новичок (Novice)';
  const progressPercent = stats.levelPercent || 0;
  const accuracy = stats.accuracy ?? 100;

  // Words dynamics
  const wordsToday = stats.wordsToday || 0;
  const wordsThisWeek = stats.wordsThisWeek || 0;
  const wordsThisMonth = stats.wordsThisMonth || 0;
  const totalWordsLearned = stats.totalWordsLearned || 0;
  const totalDictWords = stats.totalDictWords || 0;
  const totalDictPercent = totalDictWords > 0 ? Math.round((totalWordsLearned / totalDictWords) * 100) : 0;

  // SRS Stages
  const mastered = stats.masteredWords || 0;
  const review = stats.reviewWords || 0;
  const learning = stats.learningWords || 0;
  const newWords = stats.newWords || Math.max(0, totalDictWords - totalWordsLearned);
  const totalSRS = Math.max(1, mastered + review + learning + newWords);

  // Scaled widths for SRS SVG (viewBox 0 0 1000 20)
  const wMastered = Math.round((mastered / totalSRS) * 1000);
  const wReview = Math.round((review / totalSRS) * 1000);
  const wLearning = Math.round((learning / totalSRS) * 1000);
  const wNew = Math.max(0, 1000 - (wMastered + wReview + wLearning));

  // Safe arrays for resilient rendering
  const cefrItems = Array.isArray(stats.cefrBreakdown) ? stats.cefrBreakdown : [];
  const trainerItems = Array.isArray(stats.trainerBreakdown) ? stats.trainerBreakdown : [];
  const badgeItems = Array.isArray(stats.badges) ? stats.badges : [];
  const sectionItems = Array.isArray(stats.sectionBreakdown) ? stats.sectionBreakdown : [];
  const weeklyActivity = Array.isArray(stats.weeklyActivity) ? stats.weeklyActivity : [];
  const maxWeeklyCount = Math.max(...weeklyActivity.map(d => d.count || 0), 10);

  // Badges stats
  const unlockedBadgesCount = useMemo(() => badgeItems.filter(b => b.unlocked).length, [badgeItems]);

  // Trainer icon mapper
  const renderTrainerIcon = (id: string) => {
    switch (id) {
      case 'grammar':
        return <FormOutlined style={{ color: '#6366f1', fontSize: 18 }} />;
      case 'quiz':
        return <AimOutlined style={{ color: '#06b6d4', fontSize: 18 }} />;
      case 'sprint':
        return <ThunderboltFilled style={{ color: '#f59e0b', fontSize: 18 }} />;
      case 'builder':
        return <AppstoreOutlined style={{ color: '#10b981', fontSize: 18 }} />;
      case 'cards':
        return <ReadOutlined style={{ color: '#a855f7', fontSize: 18 }} />;
      case 'audio':
        return <SoundOutlined style={{ color: '#ec4899', fontSize: 18 }} />;
      default:
        return <TrophyOutlined style={{ fontSize: 18 }} />;
    }
  };

  // Badges icon mapper
  const renderBadgeIcon = (iconName: string) => {
    switch (iconName) {
      case 'RocketOutlined':
        return <RocketOutlined className={styles.badgeIcon} />;
      case 'BookOutlined':
        return <BookOutlined className={styles.badgeIcon} />;
      case 'AppstoreOutlined':
        return <AppstoreOutlined className={styles.badgeIcon} />;
      case 'AimOutlined':
        return <AimOutlined className={styles.badgeIcon} />;
      case 'FireOutlined':
        return <FireOutlined className={styles.badgeIcon} />;
      case 'ThunderboltOutlined':
        return <ThunderboltFilled className={styles.badgeIcon} />;
      case 'TrophyOutlined':
        return <TrophyOutlined className={styles.badgeIcon} />;
      case 'CrownOutlined':
        return <CrownOutlined className={styles.badgeIcon} />;
      case 'SoundOutlined':
        return <SoundOutlined className={styles.badgeIcon} />;
      case 'FormOutlined':
        return <FormOutlined className={styles.badgeIcon} />;
      default:
        return <TrophyOutlined className={styles.badgeIcon} />;
    }
  };

  // Category Tabs config
  const categoryTabs = useMemo(() => [
    { key: 'all', label: `Все (${badgeItems.length})` },
    { key: 'vocab', label: `Слова (${badgeItems.filter(b => b.category === 'vocab').length})` },
    { key: 'streak', label: `Серии (${badgeItems.filter(b => b.category === 'streak').length})` },
    { key: 'levels', label: `Уровни (${badgeItems.filter(b => b.category === 'levels').length})` },
    { key: 'xp', label: `Опыт (${badgeItems.filter(b => b.category === 'xp').length})` },
    { key: 'trainers', label: `Тренажеры (${badgeItems.filter(b => b.category === 'trainers').length})` },
    { key: 'themes', label: `Темы (${badgeItems.filter(b => b.category === 'themes').length})` },
    { key: 'memory', label: `Память (${badgeItems.filter(b => b.category === 'memory').length})` },
    { key: 'accuracy', label: `Точность (${badgeItems.filter(b => b.category === 'accuracy').length})` },
  ], [badgeItems]);

  // Badges filtered by category first
  const categoryBadges = useMemo(() => {
    if (selectedCategory === 'all') return badgeItems;
    return badgeItems.filter(b => b.category === selectedCategory);
  }, [badgeItems, selectedCategory]);

  const categoryUnlockedCount = useMemo(() => categoryBadges.filter(b => b.unlocked).length, [categoryBadges]);
  const categoryLockedCount = categoryBadges.length - categoryUnlockedCount;

  // Filtered by status and search
  const filteredBadges = useMemo(() => {
    return categoryBadges.filter(b => {
      if (statusFilter === 'unlocked' && !b.unlocked) return false;
      if (statusFilter === 'locked' && b.unlocked) return false;
      if (badgeSearch.trim()) {
        const query = badgeSearch.toLowerCase().trim();
        const matchesTitle = b.title.toLowerCase().includes(query);
        const matchesDesc = b.desc.toLowerCase().includes(query);
        const matchesCat = b.categoryName?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  }, [categoryBadges, statusFilter, badgeSearch]);

  const paginatedBadges = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBadges.slice(start, start + pageSize);
  }, [filteredBadges, currentPage, pageSize]);

  // Curriculum breakdown columns (combined grammar + trainers)
  const columns = [
    {
      title: 'Курс / Раздел',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Грамматика',
      key: 'grammarAttempted',
      render: (_: any, record: any) => (
        <Tooltip title="Попыток в грамматических вопросах">
          <Tag color="purple">{record.grammarAttempted || 0}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Тренажеры слов',
      key: 'vocabAttempted',
      render: (_: any, record: any) => (
        <Tooltip title="Попыток в интерактивных тренажерах">
          <Tag color="cyan">{record.vocabAttempted || 0}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Всего попыток',
      dataIndex: 'attempted',
      key: 'attempted',
      render: (val: number) => <Tag color="blue">{val || 0}</Tag>,
    },
    {
      title: 'Правильно',
      dataIndex: 'correct',
      key: 'correct',
      render: (val: number, record: any) => (
        <span style={{ fontWeight: 600 }}>
          <Tag color="green">{val || 0}</Tag>
          <Text type="secondary" style={{ fontSize: '0.8rem' }}>
            из {record.attempted || 0}
          </Text>
        </span>
      ),
    },
    {
      title: 'Точность раздела',
      key: 'acc',
      render: (_: any, record: any) => {
        const acc = record.attempted > 0 ? Math.round((record.correct / record.attempted) * 100) : 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={acc}
              size="small"
              className={styles.progressMini}
              strokeColor={acc >= 80 ? '#10b981' : acc >= 50 ? '#f59e0b' : '#ef4444'}
            />
            <span style={{ minWidth: 38, fontSize: '0.82rem', fontWeight: 600 }}>{acc}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className={styles.container}>
      {/* 1. Header Banner */}
      <div className={styles.headerWrapper}>
        <div>
          <Title level={2} className={styles.headerTitle}>
            Дашборд обучения
          </Title>
          <Text className={styles.headerSubtitle}>
            Детальная статистика вашего прогресса, анализ запоминания слов и динамика активности.
          </Text>
        </div>
        {onRefreshStats && (
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefreshStats}
            className={styles.refreshBtn}
          >
            Обновить
          </Button>
        )}
      </div>

      {/* 2. Top Hero Metric Cards */}
      <div className={styles.heroGrid}>
        {/* Level & Rank */}
        <Card bordered className={styles.heroCard}>
          <div className={styles.heroCardHeader}>
            <div className={`${styles.iconCircle} ${styles.iconPurple}`}>
              <TrophyFilled />
            </div>
            <div className={styles.heroMeta}>
              <span className={styles.heroLabel}>Звание и уровень</span>
              <Title level={3} className={styles.heroTitle}>
                Уровень {level}
              </Title>
              <Tag color="purple" className={styles.rankBadge}>
                {rankTitle}
              </Tag>
            </div>
          </div>
          <Progress
            percent={progressPercent}
            strokeColor={{ '0%': '#6366f1', '100%': '#a855f7' }}
          />
          <span className={styles.heroFooterText}>
            {stats.progressXP} / {stats.neededXP} XP до уровня {level + 1}
          </span>
        </Card>

        {/* Streak */}
        <Card bordered className={styles.heroCard}>
          <div className={styles.heroCardHeader}>
            <div className={`${styles.iconCircle} ${styles.iconAmber}`}>
              <FireFilled />
            </div>
            <div className={styles.heroMeta}>
              <span className={styles.heroLabel}>Серия дней</span>
              <Title level={3} className={styles.heroTitle}>
                {stats.streak} {stats.streak === 1 ? 'день' : 'дня'}
              </Title>
              <Tag color="orange" className={styles.rankBadge}>
                Огонь горит 🔥
              </Tag>
            </div>
          </div>
          <span className={styles.heroFooterText}>
            Занимайтесь каждый день, чтобы сохранять и приумножать серию!
          </span>
        </Card>

        {/* Total XP */}
        <Card bordered className={styles.heroCard}>
          <div className={styles.heroCardHeader}>
            <div className={`${styles.iconCircle} ${styles.iconCyan}`}>
              <ThunderboltFilled />
            </div>
            <div className={styles.heroMeta}>
              <span className={styles.heroLabel}>Всего опыта (XP)</span>
              <Title level={3} className={styles.heroTitle}>
                {stats.xp.toLocaleString()} XP
              </Title>
              <Tag color="cyan" className={styles.rankBadge}>
                +{wordsToday * 15} XP сегодня
              </Tag>
            </div>
          </div>
          <span className={styles.heroFooterText}>
            +{stats.correctAnswered * 15} XP начислено за правильные ответы
          </span>
        </Card>

        {/* Accuracy */}
        <Card bordered className={styles.heroCard}>
          <div className={styles.heroCardHeader}>
            <div className={`${styles.iconCircle} ${styles.iconEmerald}`}>
              <CheckCircleOutlined />
            </div>
            <div className={styles.heroMeta}>
              <span className={styles.heroLabel}>Общая точность</span>
              <Title level={3} className={styles.heroTitle}>
                {accuracy}%
              </Title>
              <Tag color={accuracy >= 80 ? 'green' : accuracy >= 60 ? 'orange' : 'red'} className={styles.rankBadge}>
                {accuracy >= 80 ? 'Отлично' : 'Требует внимания'}
              </Tag>
            </div>
          </div>
          <Progress
            percent={accuracy}
            strokeColor={accuracy >= 80 ? '#10b981' : accuracy >= 60 ? '#f59e0b' : '#ef4444'}
            showInfo={false}
          />
          <span className={styles.heroFooterText}>
            {stats.correctAnswered} из {stats.totalAnswered} ответов верно
          </span>
        </Card>
      </div>

      {/* 3. Row: Vocabulary Dynamics & Weekly Activity Chart */}
      <div className={styles.twoColGrid}>
        {/* Card A: Vocabulary Dynamics */}
        <Card
          bordered
          className={styles.sectionCard}
          title={
            <div className={styles.cardTitleHeader}>
              <RiseOutlined />
              <span>Динамика изучения слов</span>
            </div>
          }
        >
          <div className={styles.vocabMetricsGrid}>
            <div className={styles.vocabMetricBox}>
              <div className={styles.vocabMetricNumber}>{wordsToday}</div>
              <div className={styles.vocabMetricLabel}>Сегодня</div>
            </div>
            <div className={styles.vocabMetricBox}>
              <div className={styles.vocabMetricNumber}>{wordsThisWeek}</div>
              <div className={styles.vocabMetricLabel}>За 7 дней</div>
            </div>
            <div className={styles.vocabMetricBox}>
              <div className={styles.vocabMetricNumber}>{wordsThisMonth}</div>
              <div className={styles.vocabMetricLabel}>За 30 дней</div>
            </div>
          </div>

          <div className={styles.totalDictProgressBox}>
            <div className={styles.totalDictHeader}>
              <span>Освоено из активной базы</span>
              <strong>
                {totalWordsLearned} из {totalDictWords} слов ({totalDictPercent}%)
              </strong>
            </div>
            <Progress
              percent={totalDictPercent}
              strokeColor={{ '0%': '#6366f1', '100%': '#06b6d4' }}
            />
          </div>
        </Card>

        {/* Card B: Weekly Activity 7-day Bar Chart */}
        <Card
          bordered
          className={styles.sectionCard}
          title={
            <div className={styles.cardTitleHeader}>
              <ThunderboltFilled />
              <span>Активность за последние 7 дней</span>
            </div>
          }
        >
          <div className={styles.chartContainer}>
            {weeklyActivity.map((d, idx) => {
              const count = d.count || 0;
              const barHeightPct = Math.max(6, Math.min(100, Math.round((count / maxWeeklyCount) * 100)));
              const svgHeight = Math.round((barHeightPct / 100) * 110);
              const svgY = 120 - svgHeight;

              return (
                <div key={idx} className={styles.chartColumn}>
                  <div className={styles.barTrack}>
                    {count > 0 && (
                      <span className={styles.barXpPill}>
                        +{d.xp} XP
                      </span>
                    )}
                    <Tooltip title={`${d.date}: ${count} ответов / ${d.words} слов (+${d.xp} XP)`}>
                      <svg className={styles.barSvg} viewBox="0 0 36 120" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="barGradRegular" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" />
                            <stop offset="100%" stopColor="#6366f1" />
                          </linearGradient>
                          <linearGradient id="barGradToday" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ec4899" />
                            <stop offset="100%" stopColor="#a855f7" />
                          </linearGradient>
                        </defs>
                        <rect
                          x="3"
                          y={svgY}
                          width="30"
                          height={svgHeight}
                          rx="6"
                          className={d.isToday ? styles.svgBarToday : styles.svgBarRegular}
                        />
                      </svg>
                    </Tooltip>
                  </div>
                  <span className={`${styles.barDayLabel} ${d.isToday ? styles.barDayToday : ''}`}>
                    {d.day}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 4. Spaced Repetition System (SRS) Retention Stages */}
      <Card
        bordered
        className={styles.sectionCard}
        title={
          <div className={styles.cardTitleHeader}>
            <CrownOutlined />
            <span>Стадии интервального повторения (Память)</span>
          </div>
        }
      >
        {/* Multi-segment SVG Progress Bar */}
        <svg className={styles.srsSvg} viewBox="0 0 1000 20" preserveAspectRatio="none">
          {wMastered > 0 && (
            <rect x="0" y="0" width={wMastered} height="20" rx="4" className={styles.srsRectMastered} />
          )}
          {wReview > 0 && (
            <rect x={wMastered} y="0" width={wReview} height="20" className={styles.srsRectReview} />
          )}
          {wLearning > 0 && (
            <rect x={wMastered + wReview} y="0" width={wLearning} height="20" className={styles.srsRectLearning} />
          )}
          {wNew > 0 && (
            <rect x={wMastered + wReview + wLearning} y="0" width={wNew} height="20" rx="4" className={styles.srsRectNew} />
          )}
        </svg>

        <div className={styles.srsCardsGrid}>
          <div className={styles.srsStageCard}>
            <div>
              <span className={`${styles.stageDot} ${styles.dotMastered}`} />
              <Text strong>Закреплено</Text>
            </div>
            <div className={styles.stageCount}>{mastered}</div>
            <div className={styles.stageDesc}>Долговременная память (интервал 21+ дн.)</div>
          </div>

          <div className={styles.srsStageCard}>
            <div>
              <span className={`${styles.stageDot} ${styles.dotReview}`} />
              <Text strong>В повторении</Text>
            </div>
            <div className={styles.stageCount}>{review}</div>
            <div className={styles.stageDesc}>Регулярный цикл (интервал 3–20 дн.)</div>
          </div>

          <div className={styles.srsStageCard}>
            <div>
              <span className={`${styles.stageDot} ${styles.dotLearning}`} />
              <Text strong>Изучается</Text>
            </div>
            <div className={styles.stageCount}>{learning}</div>
            <div className={styles.stageDesc}>Активное освоение (интервал до 3 дн.)</div>
          </div>

          <div className={styles.srsStageCard}>
            <div>
              <span className={`${styles.stageDot} ${styles.dotNew}`} />
              <Text strong>Новые слова</Text>
            </div>
            <div className={styles.stageCount}>{newWords}</div>
            <div className={styles.stageDesc}>Доступны в базе для добавления</div>
          </div>
        </div>
      </Card>

      {/* 5. CEFR Level Mastery */}
      <Card
        bordered
        className={styles.sectionCard}
        title={
          <div className={styles.cardTitleHeader}>
            <BookOutlined />
            <span>Освоение по уровням CEFR</span>
          </div>
        }
      >
        <div className={styles.cefrGrid}>
          {cefrItems.map((c) => {
            let levelTitle = 'Начальный';
            let tagColor = 'blue';
            if (c.level === 'A1') { levelTitle = 'Beginner'; tagColor = 'blue'; }
            else if (c.level === 'A2') { levelTitle = 'Elementary'; tagColor = 'cyan'; }
            else if (c.level === 'B1') { levelTitle = 'Intermediate'; tagColor = 'green'; }
            else if (c.level === 'B2') { levelTitle = 'Upper-Interm.'; tagColor = 'orange'; }
            else if (c.level === 'C1') { levelTitle = 'Advanced'; tagColor = 'purple'; }

            return (
              <div key={c.level} className={styles.cefrCard}>
                <div className={styles.cefrLevelHeader}>
                  <Tag color={tagColor}>{c.level}</Tag>
                  <span className={styles.cefrTitle}>{levelTitle}</span>
                </div>
                <div>
                  <Text strong>{c.count}</Text> / {c.total} слов
                </div>
                <Progress
                  percent={c.percent}
                  size="small"
                  strokeColor={{ '0%': '#6366f1', '100%': '#06b6d4' }}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* 6. Trainer Accuracy Breakdown across all 6 modes */}
      <Card
        bordered
        className={styles.sectionCard}
        title={
          <div className={styles.cardTitleHeader}>
            <CheckCircleOutlined />
            <span>Точность по режимам тренировок (все 6 тренажеров)</span>
          </div>
        }
      >
        <div className={styles.trainerGrid}>
          {trainerItems.map((t) => (
            <div key={t.id} className={styles.trainerItem}>
              <div className={styles.trainerTop}>
                <span className={styles.trainerName}>
                  {renderTrainerIcon(t.id)} {t.name}
                </span>
                <span className={styles.trainerAccuracyPill}>{t.accuracy}%</span>
              </div>
              <Progress
                percent={t.accuracy}
                strokeColor={t.accuracy >= 80 ? '#10b981' : t.accuracy >= 60 ? '#f59e0b' : '#ef4444'}
              />
              <span className={styles.heroFooterText}>
                {t.correct} верных из {t.attempted} попыток
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* 7. Curriculum Breakdown by Section (Grammar + Trainers) */}
      <Card
        bordered
        className={styles.tableCard}
        title={
          <div className={styles.cardTitleHeader}>
            <AppstoreOutlined />
            <span>Успеваемость по разделам платформы (Грамматика + Тренажеры)</span>
          </div>
        }
      >
        <Table
          dataSource={sectionItems}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: 650 }}
        />
      </Card>

      {/* 8. Achievements and Milestones (150-200 achievements with categories & filters) */}
      <Card
        bordered
        className={styles.sectionCard}
        title={
          <div className={styles.badgesCardHeader}>
            <div className={styles.cardTitleHeader}>
              <TrophyOutlined />
              <span>Достижения и вехи ({badgeItems.length})</span>
            </div>
            <div className={styles.badgesSummaryPill}>
              Разблокировано: <strong>{unlockedBadgesCount}</strong> из {badgeItems.length} ({badgeItems.length > 0 ? Math.round((unlockedBadgesCount / badgeItems.length) * 100) : 0}%)
            </div>
          </div>
        }
      >
        {/* Category Tabs */}
        <div className={styles.badgesTabsWrapper}>
          <Tabs
            activeKey={selectedCategory}
            onChange={(key) => {
              setSelectedCategory(key);
              setCurrentPage(1);
            }}
            items={categoryTabs}
            className={styles.badgesTabs}
          />
        </div>

        {/* Filters and Search toolbar */}
        <div className={styles.badgesToolbar}>
          <Segmented
            value={statusFilter}
            onChange={(val) => {
              setStatusFilter(val as string);
              setCurrentPage(1);
            }}
            options={[
              { label: `Все (${categoryBadges.length})`, value: 'all' },
              { label: `Открыто (${categoryUnlockedCount})`, value: 'unlocked' },
              { label: `В процессе (${categoryLockedCount})`, value: 'locked' }
            ]}
          />
          <Input
            placeholder="Поиск достижения..."
            prefix={<SearchOutlined />}
            allowClear
            value={badgeSearch}
            onChange={(e) => {
              setBadgeSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{ maxWidth: 260 }}
          />
        </div>

        {/* Badges Grid */}
        <div className={styles.badgesGrid}>
          {paginatedBadges.map((b) => (
            <div
              key={b.id}
              className={`${styles.badgeCard} ${b.unlocked ? styles.badgeUnlocked : styles.badgeLocked}`}
            >
              <div className={styles.badgeIconWrapper}>
                {renderBadgeIcon(b.icon)}
              </div>
              <div className={styles.badgeText}>
                <div className={styles.badgeHeaderRow}>
                  <span className={styles.badgeTitle}>{b.title}</span>
                  {b.categoryName && (
                    <Tag className={styles.badgeCategoryTag}>{b.categoryName}</Tag>
                  )}
                </div>
                <span className={styles.badgeDesc}>{b.desc}</span>
                {b.unlocked ? (
                  <div className={styles.badgeStatusRow}>
                    <Tag color="success" icon={<CheckOutlined />}>
                      Разблокировано
                    </Tag>
                  </div>
                ) : (
                  <div className={styles.badgeProgressBox}>
                    <div className={styles.badgeProgressLabel}>
                      <span>Прогресс: {b.current ?? 0} / {b.target ?? 1}</span>
                      <span>{b.percent ?? 0}%</span>
                    </div>
                    <Progress
                      percent={b.percent ?? 0}
                      size="small"
                      showInfo={false}
                      strokeColor={{ '0%': '#6366f1', '100%': '#a855f7' }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {filteredBadges.length > pageSize && (
          <div className={styles.badgesPaginationWrapper}>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredBadges.length}
              onChange={(page) => setCurrentPage(page)}
              showSizeChanger={false}
            />
          </div>
        )}
      </Card>
    </div>
  );
};