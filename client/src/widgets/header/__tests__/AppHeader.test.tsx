import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppHeader } from '../ui/AppHeader';
import { UserStats } from '@/entities/user';
import { AuthUser } from '@/features/auth';

const mockStats: UserStats = {
  xp: 450,
  streak: 5,
  level: 3,
  wordsLearned: 35,
  questionsAnswered: 80,
  accuracy: 85,
  dailyGoal: 50,
  dailyProgress: 30,
};

const mockUser: AuthUser = {
  id: 1,
  username: 'AlexCoder',
  email: 'alex@example.com',
  total_xp: 450,
  streak_days: 5,
};

function renderHeader(props: Partial<React.ComponentProps<typeof AppHeader>> = {}, initialPath = '/trainers') {
  const defaultProps = {
    stats: mockStats,
    isDark: true,
    onToggleTheme: vi.fn(),
    currentUser: mockUser,
    onOpenAuth: vi.fn(),
    onLogout: vi.fn(),
    onTabChange: vi.fn(),
  };

  return {
    ...render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="*" element={<AppHeader {...defaultProps} {...props} />} />
        </Routes>
      </MemoryRouter>
    ),
    props: { ...defaultProps, ...props },
  };
}

describe('AppHeader UI Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should render brand logo and name Fluentiq', () => {
    renderHeader();
    expect(screen.getByText('FQ')).toBeInTheDocument();
    expect(screen.getByText('Fluentiq')).toBeInTheDocument();
    expect(screen.getByText('English Mastery')).toBeInTheDocument();
  });

  it('2. should render desktop navigation links: Тренажеры, Словарь, Дашборд, История', () => {
    const { container } = renderHeader();
    const desktopNav = container.querySelector('.desktopNav') as HTMLElement;
    expect(within(desktopNav).getByRole('button', { name: /🎮 Тренажеры/i })).toBeInTheDocument();
    expect(within(desktopNav).getByRole('button', { name: /Словарь/i })).toBeInTheDocument();
    expect(within(desktopNav).getByRole('button', { name: /Дашборд/i })).toBeInTheDocument();
    expect(within(desktopNav).getByRole('button', { name: /История/i })).toBeInTheDocument();
  });

  it('3. should highlight active tab corresponding to the route', () => {
    const { container } = renderHeader({}, '/dictionary');
    const desktopNav = container.querySelector('.desktopNav') as HTMLElement;
    const dictBtn = within(desktopNav).getByRole('button', { name: /Словарь/i });
    expect(dictBtn.className).toMatch(/ant-btn-primary/);
  });

  it('4. should call onTabChange when navigation tab is clicked', () => {
    const onTabChange = vi.fn();
    const { container } = renderHeader({ onTabChange });

    const desktopNav = container.querySelector('.desktopNav') as HTMLElement;
    const dictBtn = within(desktopNav).getByRole('button', { name: /Словарь/i });
    fireEvent.click(dictBtn);

    expect(onTabChange).toHaveBeenCalledWith('dictionary');
  });

  it('5. should display XP and streak tags from stats prop', () => {
    renderHeader();
    expect(screen.getByText(/450 XP/i)).toBeInTheDocument();
    expect(screen.getByText(/5 дн\./i)).toBeInTheDocument();
    expect(screen.getByText(/Lvl 3/i)).toBeInTheDocument();
  });

  it('6. should display user avatar and username when user is authenticated', () => {
    renderHeader({ currentUser: mockUser });
    expect(screen.getByText('AlexCoder')).toBeInTheDocument();
  });

  it('7. should render Войти button when currentUser is guest or null', () => {
    renderHeader({ currentUser: null });
    expect(screen.getByRole('button', { name: /Войти/i })).toBeInTheDocument();
  });

  it('8. should call onOpenAuth when clicking Войти button', () => {
    const onOpenAuth = vi.fn();
    renderHeader({ currentUser: null, onOpenAuth });

    const loginBtn = screen.getByRole('button', { name: /Войти/i });
    fireEvent.click(loginBtn);

    expect(onOpenAuth).toHaveBeenCalled();
  });

  it('9. should render theme toggle button with lightbulb icon', () => {
    renderHeader();
    const themeBtn = screen.getByTitle('Сменить тему');
    expect(themeBtn).toBeInTheDocument();
  });

  it('10. should call onToggleTheme when clicking theme toggle button', () => {
    const onToggleTheme = vi.fn();
    renderHeader({ onToggleTheme });

    const themeBtn = screen.getByTitle('Сменить тему');
    fireEvent.click(themeBtn);

    expect(onToggleTheme).toHaveBeenCalled();
  });

  it('11. should open mobile drawer when clicking hamburger button', () => {
    renderHeader();
    const burgerBtn = screen.getByLabelText('Меню приложения');
    fireEvent.click(burgerBtn);

    expect(screen.getByText('Fluentiq Меню')).toBeInTheDocument();
  });

  it('12. should render mobile navigation links inside drawer', () => {
    renderHeader();
    const burgerBtn = screen.getByLabelText('Меню приложения');
    fireEvent.click(burgerBtn);

    const drawer = screen.getByText('Fluentiq Меню').closest('.ant-drawer');
    expect(drawer).not.toBeNull();
  });

  it('13. should apply dark theme class when isDark is true', () => {
    const { container } = renderHeader({ isDark: true });
    const header = container.querySelector('header');
    expect(header?.className).toMatch(/dark/);
  });

  it('14. should apply light theme class when isDark is false', () => {
    const { container } = renderHeader({ isDark: false });
    const header = container.querySelector('header');
    expect(header?.className).toMatch(/light/);
  });

  it('15. should trigger tab change to arcade when clicking brand logo', () => {
    const onTabChange = vi.fn();
    const { container } = renderHeader({ onTabChange });

    const brand = container.querySelector('.brand') as HTMLElement;
    fireEvent.click(brand);

    expect(onTabChange).toHaveBeenCalledWith('arcade');
  });

  it('16. should navigate to stats dashboard when streak, xp, or level tags are clicked', () => {
    const onTabChange = vi.fn();
    renderHeader({ onTabChange });

    const streakTag = screen.getByText(/5 дн\./i);
    fireEvent.click(streakTag);
    expect(onTabChange).toHaveBeenCalledWith('stats');

    onTabChange.mockClear();
    const xpTag = screen.getByText(/450 XP/i);
    fireEvent.click(xpTag);
    expect(onTabChange).toHaveBeenCalledWith('stats');

    onTabChange.mockClear();
    const levelTag = screen.getByText(/Lvl 3/i);
    fireEvent.click(levelTag);
    expect(onTabChange).toHaveBeenCalledWith('stats');
  });
});
