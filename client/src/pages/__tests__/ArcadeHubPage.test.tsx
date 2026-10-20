import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ArcadeHubPage } from '../ArcadeHubPage';
import { sectionApi } from '@/entities/section/api/sectionApi';
import { dictionaryApi } from '@/entities/dictionary/api/dictionaryApi';
import { AuthUser } from '@/features/auth/ui/AuthModal';

const mockUser: AuthUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  total_xp: 350,
  streak_days: 4,
};

const mockSections = [
  {
    id: 'food',
    title: 'Еда и напитки',
    description: 'Food & drinks vocabulary',
    default_level: 'A1',
    icon: 'CoffeeOutlined',
  },
  {
    id: 'travel',
    title: 'Путешествия',
    description: 'Travel vocabulary',
    default_level: 'A2',
    icon: 'CompassOutlined',
  },
];

describe('ArcadeHubPage UI Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValue({
      data: [],
      pagination: { total: 142, page: 1, limit: 1, totalPages: 142, totalInDb: 142 } as any,
    });
    vi.spyOn(sectionApi, 'getSections').mockResolvedValue(mockSections);
  });

  it('1. should render arcade hub page title and description', () => {
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2, name: /Интерактивные тренажеры/i })).toBeInTheDocument();
    expect(screen.getByText(/Разносторонние форматы обучения/i)).toBeInTheDocument();
  });

  it('2. should display guest alert when currentUser is null', () => {
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={null} sections={mockSections} />
      </MemoryRouter>
    );

    expect(screen.getByText(/Внимание: гостевой режим/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Войти/i })).toBeInTheDocument();
  });

  it('3. should NOT display guest alert when currentUser is logged in', () => {
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Внимание: гостевой режим/i)).toBeNull();
  });

  it('4. should call onRequireAuth when clicking Войти button in guest alert', () => {
    const onRequireAuth = vi.fn();
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={null} sections={mockSections} onRequireAuth={onRequireAuth} />
      </MemoryRouter>
    );

    const loginBtn = screen.getByRole('button', { name: /Войти/i });
    fireEvent.click(loginBtn);

    expect(onRequireAuth).toHaveBeenCalled();
  });

  it('5. should render all level buttons (Все уровни, A1, A2, B1, B2, C1)', () => {
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Все уровни/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'B2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'C1' })).toBeInTheDocument();
  });

  it('6. should highlight clicked level button', () => {
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    const b1Btn = screen.getByRole('button', { name: 'B1' });
    fireEvent.click(b1Btn);

    expect(b1Btn.className).toMatch(/activeLevelBtn/);
  });

  it('7. should render total words in DB tag', async () => {
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Слов в базе:/i)).toBeInTheDocument();
      expect(screen.getByText('142')).toBeInTheDocument();
    });
  });

  it('8. should render all 6 trainer cards', () => {
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 4, name: 'Грамматика и контекст' })).toBeInTheDocument();
    expect(screen.getByText(/Квиз: выбор 1 из 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Скоростной Спринт \(60с\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Конструктор слов \(Спеллинг\)/i)).toBeInTheDocument();
    expect(screen.getByText(/3D Флеш-карточки \(SRS\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Аудирование и диктант/i)).toBeInTheDocument();
  });

  it('9. should render badges for all trainer cards', () => {
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    expect(screen.getByText('Правила & Тесты')).toBeInTheDocument();
    expect(screen.getByText('Популярное')).toBeInTheDocument();
    expect(screen.getByText('Динамично')).toBeInTheDocument();
    expect(screen.getByText('Правописание')).toBeInTheDocument();
    expect(screen.getByText('Интервально')).toBeInTheDocument();
    expect(screen.getByText('Восприятие на слух')).toBeInTheDocument();
  });

  it('10. should render XP reward tags for all trainer cards', () => {
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    expect(screen.getByText(/\+20 XP за задание/i)).toBeInTheDocument();
    expect(screen.getByText(/\+15 XP за верный ответ/i)).toBeInTheDocument();
    expect(screen.getByText(/До \+150 XP за игру/i)).toBeInTheDocument();
    expect(screen.getByText(/\+20 XP за слово/i)).toBeInTheDocument();
    expect(screen.getByText(/\+10 XP за карточку/i)).toBeInTheDocument();
    expect(screen.getByText(/\+25 XP за фразу/i)).toBeInTheDocument();
  });

  it('11. should require auth when unauthenticated user clicks to play any trainer', async () => {
    const onRequireAuth = vi.fn();
    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={null} sections={mockSections} onRequireAuth={onRequireAuth} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('hub-loading-banner')).toBeNull();
    });

    const playButtons = screen.getAllByRole('button', { name: /Играть/i });
    await waitFor(() => {
      expect(playButtons[0]).not.toHaveClass('ant-btn-loading');
      expect(playButtons[0]).not.toBeDisabled();
    });
    fireEvent.click(playButtons[0]);

    expect(onRequireAuth).toHaveBeenCalled();
  });

  it('12. should navigate to /trainers/quiz when authenticated user clicks to play quiz', async () => {
    render(
      <MemoryRouter initialEntries={['/trainers']}>
        <Routes>
          <Route path="/trainers" element={<ArcadeHubPage currentUser={mockUser} sections={mockSections} />} />
          <Route path="/trainers/quiz" element={<div>Quiz Trainer Route Active</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('hub-loading-banner')).toBeNull();
    });

    const playBtn = screen.getByTestId('play-btn-quiz');
    await waitFor(() => {
      expect(playBtn).not.toHaveClass('ant-btn-loading');
      expect(playBtn).not.toBeDisabled();
    });
    fireEvent.click(playBtn);

    await waitFor(() => {
      expect(screen.getByText('Quiz Trainer Route Active')).toBeInTheDocument();
    });
  });

  it('13. should navigate with level and category search params when filters are set', async () => {
    render(
      <MemoryRouter initialEntries={['/trainers']}>
        <Routes>
          <Route path="/trainers" element={<ArcadeHubPage currentUser={mockUser} sections={mockSections} />} />
          <Route path="/trainers/grammar" element={<div>Grammar Route Active</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('hub-loading-banner')).toBeNull();
    });

    // Select A1 level
    const a1Btn = screen.getByRole('button', { name: 'A1' });
    fireEvent.click(a1Btn);

    await waitFor(() => {
      expect(screen.queryByTestId('hub-loading-banner')).toBeNull();
    });

    const grammarCard = screen.getByRole('heading', { level: 4, name: 'Грамматика и контекст' }).closest('.modeCard') as HTMLElement;
    const trainBtn = grammarCard.querySelector('button') as HTMLButtonElement;
    await waitFor(() => {
      expect(trainBtn).not.toHaveClass('ant-btn-loading');
      expect(trainBtn).not.toBeDisabled();
    });
    fireEvent.click(trainBtn);

    await waitFor(() => {
      expect(screen.getByText('Grammar Route Active')).toBeInTheDocument();
    });
  });

  it('14. should load sections via API when prop sections is empty', async () => {
    const getSectionsSpy = vi.spyOn(sectionApi, 'getSections').mockResolvedValue(mockSections);

    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={[]} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getSectionsSpy).toHaveBeenCalled();
    });
  });

  it('15. should re-fetch dictionary count when selected level changes', async () => {
    const getDictSpy = vi.spyOn(dictionaryApi, 'getDictionary');

    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getDictSpy).toHaveBeenCalledWith(expect.objectContaining({ level: 'all' }));
    });

    const a2Btn = screen.getByRole('button', { name: 'A2' });
    fireEvent.click(a2Btn);

    await waitFor(() => {
      expect(getDictSpy).toHaveBeenCalledWith(expect.objectContaining({ level: 'A2' }));
    });
  });

  it('16. should show spinner loader in db count tag without jumping banner while in flight', () => {
    // Return promise that never resolves immediately
    vi.spyOn(dictionaryApi, 'getDictionary').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    const countTag = screen.getByTestId('db-count-tag');
    expect(countTag).toBeInTheDocument();
    // Verify spinner is rendered inside tag and banner is removed
    expect(countTag.querySelector('.ant-spin')).not.toBeNull();
    expect(screen.queryByTestId('hub-loading-banner')).toBeNull();
  });

  it('17. should block entrance to trainers when loading is in progress', () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/trainers']}>
        <Routes>
          <Route path="/trainers" element={<ArcadeHubPage currentUser={mockUser} sections={mockSections} />} />
          <Route path="/trainers/quiz" element={<div>Quiz Trainer Route Active</div>} />
        </Routes>
      </MemoryRouter>
    );

    const playBtn = screen.getByTestId('play-btn-quiz');
    expect(playBtn).toBeDisabled();

    fireEvent.click(playBtn);
    expect(screen.queryByText('Quiz Trainer Route Active')).toBeNull();
  });

  it('18. should display warning alert and disable vocabulary trainer buttons when total words is 0', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValue({
      data: [],
      pagination: { total: 0, totalInDb: 0 } as any,
    });

    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('hub-empty-words-alert')).toBeInTheDocument();
      expect(screen.getByText(/В базе пока нет слов для уровня Все уровни/i)).toBeInTheDocument();
    });

    const playBtnQuiz = screen.getByTestId('play-btn-quiz');
    expect(playBtnQuiz).toBeDisabled();
    expect(playBtnQuiz).toHaveTextContent('Нет слов');
  });

  it('19. should allow generating words when words count is 0 and unlock trainers after generation', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary')
      .mockResolvedValueOnce({
        data: [],
        pagination: { total: 0, totalInDb: 0 } as any,
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { total: 35, totalInDb: 35 } as any,
      });

    const genWordsSpy = vi.spyOn(dictionaryApi, 'generateWords').mockResolvedValue({
      success: true,
      data: Array(35).fill({ id: 1, word: 'test' }),
      message: 'Добавлено 35 новых слов',
    });

    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('hub-empty-words-alert')).toBeInTheDocument();
    });

    const genBtn = screen.getByTestId('hub-generate-words-btn');
    fireEvent.click(genBtn);

    await waitFor(() => {
      expect(genWordsSpy).toHaveBeenCalled();
      expect(screen.getByText('35')).toBeInTheDocument();
    });

    const playBtnQuiz = screen.getByTestId('play-btn-quiz');
    expect(playBtnQuiz).not.toBeDisabled();
    expect(playBtnQuiz).toHaveTextContent('Играть');
  });

  it('20. should eliminate race conditions when rapidly switching between levels', async () => {
    let resolveFirst: any;
    let resolveSecond: any;

    const firstPromise = new Promise(resolve => { resolveFirst = resolve; });
    const secondPromise = new Promise(resolve => { resolveSecond = resolve; });

    const getDictSpy = vi.spyOn(dictionaryApi, 'getDictionary')
      .mockReturnValueOnce(firstPromise as any)
      .mockReturnValueOnce(secondPromise as any);

    render(
      <MemoryRouter>
        <ArcadeHubPage currentUser={mockUser} sections={mockSections} />
      </MemoryRouter>
    );

    // Rapidly switch from all to B1
    const b1Btn = screen.getByRole('button', { name: 'B1' });
    fireEvent.click(b1Btn);

    expect(getDictSpy).toHaveBeenCalledTimes(2);

    // Second request (B1) finishes FIRST
    resolveSecond({
      data: [],
      pagination: { total: 42, totalInDb: 42 } as any,
    });

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    // Stale first request finishes LATER
    resolveFirst({
      data: [],
      pagination: { total: 999, totalInDb: 999 } as any,
    });

    // Value should NOT be overwritten by the stale request
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.queryByText('999')).toBeNull();
    });
  });
});
