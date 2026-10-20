import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatsOverview } from '../ui/StatsOverview';
import { UserStats } from '@/entities/user';

describe('StatsOverview Component & Analytics Suite', () => {
  const mockTrainers = [
    { id: 'grammar', name: 'Грамматический тренажер', icon: 'FormOutlined', attempted: 20, correct: 18, accuracy: 90 },
    { id: 'quiz', name: 'Тест на выбор (Квиз)', icon: 'AimOutlined', attempted: 15, correct: 12, accuracy: 80 },
    { id: 'sprint', name: 'Спринт слов', icon: 'ThunderboltOutlined', attempted: 25, correct: 20, accuracy: 80 },
    { id: 'builder', name: 'Конструктор слов', icon: 'AppstoreOutlined', attempted: 10, correct: 9, accuracy: 90 },
    { id: 'cards', name: 'Умные карточки (SRS)', icon: 'ReadOutlined', attempted: 30, correct: 27, accuracy: 90 },
    { id: 'audio', name: 'Аудиовызов', icon: 'SoundOutlined', attempted: 8, correct: 6, accuracy: 75 },
  ];

  const mockSections = [
    {
      id: 'grammar',
      title: 'Грамматика и конструкции',
      attempted: 25,
      correct: 22,
      accuracy: 88,
      grammarAttempted: 15,
      vocabAttempted: 10
    },
    {
      id: 'business',
      title: 'Деловой английский',
      attempted: 18,
      correct: 15,
      accuracy: 83,
      grammarAttempted: 6,
      vocabAttempted: 12
    }
  ];

  const mockBadges = [
    { id: 'first_step', category: 'trainers', categoryName: 'Первые шаги', title: 'Первый шаг', desc: 'Первая тренировка пройдена', icon: 'RocketOutlined', current: 1, target: 1, percent: 100, unlocked: true },
    { id: 'words_50', category: 'vocab', categoryName: 'Словарный запас', title: 'Словарный запас: 50 слов', desc: 'Освойте 50 слов', icon: 'BookOutlined', current: 50, target: 50, percent: 100, unlocked: true },
    { id: 'words_100', category: 'vocab', categoryName: 'Словарный запас', title: 'Словарный запас: 100 слов', desc: 'Освойте 100 слов', icon: 'BookOutlined', current: 50, target: 100, percent: 50, unlocked: false },
    { id: 'streak_3', category: 'streak', categoryName: 'Серии дней', title: 'Серия: 3 дня', desc: 'Занимайтесь 3 дня подряд', icon: 'FireOutlined', current: 3, target: 3, percent: 100, unlocked: true },
    { id: 'streak_7', category: 'streak', categoryName: 'Серии дней', title: 'Серия: 7 дней', desc: 'Занимайтесь 7 дней подряд', icon: 'FireOutlined', current: 3, target: 7, percent: 43, unlocked: false },
    { id: 'lvl_5', category: 'levels', categoryName: 'Уровни и звания', title: 'Уровень 5', desc: 'Достигните 5 уровня', icon: 'TrophyOutlined', current: 4, target: 5, percent: 80, unlocked: false },
    { id: 'xp_500', category: 'xp', categoryName: 'Опыт (XP)', title: 'Опыт: 500 XP', desc: 'Наберите 500 XP', icon: 'ThunderboltOutlined', current: 500, target: 500, percent: 100, unlocked: true },
  ];

  const mockStats: UserStats = {
    user: { id: 'test-1', username: 'Alex', xp: 1200, streak: 3 },
    xp: 1200,
    level: 4,
    levelPercent: 65,
    progressXP: 130,
    neededXP: 200,
    streak: 3,
    totalAnswered: 108,
    correctAnswered: 92,
    accuracy: 85,
    rankTitle: 'Практик (Practitioner)',
    trainerBreakdown: mockTrainers,
    sectionBreakdown: mockSections,
    badges: mockBadges,
    wordsToday: 12,
    wordsThisWeek: 45,
    wordsThisMonth: 120,
    totalWordsLearned: 150,
    totalDictWords: 500,
    masteredWords: 35,
    reviewWords: 45,
    learningWords: 70,
    newWords: 350,
    weeklyActivity: [
      { day: 'Пн', date: '2026-10-14', count: 10, words: 5, xp: 150, isToday: false },
      { day: 'Вт', date: '2026-10-15', count: 15, words: 8, xp: 225, isToday: false },
      { day: 'Ср', date: '2026-10-16', count: 8, words: 4, xp: 120, isToday: false },
      { day: 'Чт', date: '2026-10-17', count: 20, words: 10, xp: 300, isToday: false },
      { day: 'Пт', date: '2026-10-18', count: 18, words: 9, xp: 270, isToday: false },
      { day: 'Сб', date: '2026-10-19', count: 25, words: 12, xp: 375, isToday: false },
      { day: 'Вс', date: '2026-10-20', count: 12, words: 6, xp: 180, isToday: true },
    ]
  };

  it('1. should render header, rank, and refresh button', () => {
    const onRefresh = vi.fn();
    render(<StatsOverview stats={mockStats} onRefreshStats={onRefresh} />);

    expect(screen.getByText('Дашборд обучения')).toBeInTheDocument();
    expect(screen.getByText('Практик (Practitioner)')).toBeInTheDocument();

    const refreshBtn = screen.getByText('Обновить');
    fireEvent.click(refreshBtn);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('2. should display all 6 interactive trainers with individual accuracy', () => {
    render(<StatsOverview stats={mockStats} />);

    expect(screen.getByText(/Грамматический тренажер/i)).toBeInTheDocument();
    expect(screen.getByText(/Тест на выбор \(Квиз\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Спринт слов/i)).toBeInTheDocument();
    expect(screen.getByText(/Конструктор слов/i)).toBeInTheDocument();
    expect(screen.getByText(/Умные карточки \(SRS\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Аудиовызов/i)).toBeInTheDocument();

    const accuracyValues = screen.getAllByText('75%');
    expect(accuracyValues.length).toBeGreaterThan(0);
  });

  it('3. should display section breakdown combining both grammar and trainer attempts', () => {
    render(<StatsOverview stats={mockStats} />);

    expect(screen.getByText('Грамматика и конструкции')).toBeInTheDocument();
    expect(screen.getByText('Деловой английский')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Грамматика/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Тренажеры слов/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Всего попыток/i })).toBeInTheDocument();
  });

  it('4. should render achievements summary and unlocked counter', () => {
    render(<StatsOverview stats={mockStats} />);

    // 4 unlocked out of 7 mock badges
    expect(screen.getByText(/Разблокировано:/i)).toBeInTheDocument();
    expect(screen.getByText('Первый шаг')).toBeInTheDocument();
  });

  it('5. should filter achievements by category tabs', () => {
    render(<StatsOverview stats={mockStats} />);

    // Click "Серии" tab
    const streakTab = screen.getByRole('tab', { name: /Серии/i });
    fireEvent.click(streakTab);

    expect(screen.getByText('Серия: 3 дня')).toBeInTheDocument();
    expect(screen.getByText('Серия: 7 дней')).toBeInTheDocument();
  });

  it('6. should filter achievements by status (Открыто vs В процессе)', () => {
    render(<StatsOverview stats={mockStats} />);

    // Click "Открыто" in Segmented
    const unlockedRadio = screen.getByText(/Открыто/i);
    fireEvent.click(unlockedRadio);

    expect(screen.getByText('Первый шаг')).toBeInTheDocument();
  });

  it('7. should filter achievements dynamically via search input', () => {
    render(<StatsOverview stats={mockStats} />);

    const searchInput = screen.getByPlaceholderText('Поиск достижения...');
    fireEvent.change(searchInput, { target: { value: '50 слов' } });

    expect(screen.getByText('Словарный запас: 50 слов')).toBeInTheDocument();
  });

  it('8. should render unlocked achievements sorted at the very top of the list', () => {
    const { container } = render(<StatsOverview stats={mockStats} />);

    // All unlocked badges (first_step, words_50, streak_3, xp_500) must appear before locked ones
    const badgeTitles = container.querySelectorAll('.badgeTitle');
    const unlockedTitles = ['Первый шаг', 'Словарный запас: 50 слов', 'Серия: 3 дня', 'Опыт: 500 XP'];
    expect(unlockedTitles).toContain(badgeTitles[0].textContent);
    expect(unlockedTitles).toContain(badgeTitles[1].textContent);
    expect(unlockedTitles).toContain(badgeTitles[2].textContent);
    expect(unlockedTitles).toContain(badgeTitles[3].textContent);
  });
});
