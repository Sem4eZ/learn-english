import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { PracticePage } from '../PracticePage';
import { questionApi } from '@/entities/question/api/questionApi';
import { soundEffects } from '@/shared/lib/audio';

const mockSection = {
  id: 'grammar',
  title: '📘 Грамматика и конструкции',
  description: 'Времена, пассивный залог и модальные глаголы',
  default_level: 'B1',
  icon: 'BookOutlined',
};

const mockQuestion = {
  id: 101,
  section_id: 'grammar',
  level: 'B1',
  question_text: 'She ___ to the cinema yesterday.',
  options: ['went', 'goes', 'has gone', 'is going'],
  correct_answer: 'went',
  explanation: 'Past Simple is used for finished actions in the past with a specific time.',
  rule_summary: 'Past Simple: V2 / ed for completed past actions.',
  topic: 'Past Simple',
  context_text: 'Talking about yesterday evening activities.',
};

function renderPracticePage(props: Partial<React.ComponentProps<typeof PracticePage>> = {}) {
  const defaultProps = {
    section: mockSection,
    allSections: [mockSection],
    initialSectionId: 'grammar',
    initialLevel: 'B1',
    onBack: vi.fn(),
    onRefreshStats: vi.fn(),
  };

  return {
    ...render(
      <Provider store={store}>
        <PracticePage {...defaultProps} {...props} />
      </Provider>
    ),
    props: { ...defaultProps, ...props },
  };
}

describe('PracticePage UI Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should render section title and subtitle', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });

    renderPracticePage();

    expect(screen.getByRole('heading', { level: 3, name: /📘 Грамматика и конструкции/i })).toBeInTheDocument();
    expect(screen.getByText(/Практические задания, вставка предлогов/i)).toBeInTheDocument();
  });

  it('2. should display level and topic tags in the header', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });

    renderPracticePage();

    expect(screen.getByText(/Уровень B1/i)).toBeInTheDocument();
  });

  it('3. should NOT contain level or topic selector dropdowns (ensuring clean arcade UX)', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });

    const { container } = renderPracticePage();

    // Verify there are no select elements / comboboxes for level or topic
    expect(container.querySelector('.ant-select')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('4. should call onBack when clicking Назад к тренажерам button', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });

    const onBack = vi.fn();
    renderPracticePage({ onBack });

    const backBtn = screen.getByRole('button', { name: /Назад к тренажерам/i });
    fireEvent.click(backBtn);

    expect(onBack).toHaveBeenCalled();
  });

  it('5. should show loading indicator while fetching questions', () => {
    vi.spyOn(questionApi, 'getQuestions').mockImplementation(() => new Promise(() => {}));

    renderPracticePage();

    expect(screen.getByText(/Загрузка заданий.../i)).toBeInTheDocument();
  });

  it('6. should render QuestionCard when questions are loaded', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByText('She ___ to the cinema yesterday.')).toBeInTheDocument();
    });
  });

  it('7. should render question number tag and context text', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByText(/Вопрос #1/i)).toBeInTheDocument();
      expect(screen.getByText(/"Talking about yesterday evening activities."/i)).toBeInTheDocument();
    });
  });

  it('8. should render all answer options buttons', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /went/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /goes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /has gone/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /is going/i })).toBeInTheDocument();
    });
  });

  it('9. should speak question text when audio button is clicked', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });
    const speakSpy = vi.spyOn(soundEffects, 'speak').mockImplementation(() => {});

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByText('She ___ to the cinema yesterday.')).toBeInTheDocument();
    });

    const audioBtn = screen.getByTitle('Прослушать вопрос');
    fireEvent.click(audioBtn);

    expect(speakSpy).toHaveBeenCalledWith('She ___ to the cinema yesterday.');
  });

  it('10. should submit answer and display explanation on option click', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });
    vi.spyOn(questionApi, 'submitAnswer').mockResolvedValue({
      isCorrect: true,
      correctAnswer: 'went',
      explanation: 'Past Simple is used for finished actions in the past with a specific time.',
      xpEarned: 15,
      streak: 3,
      totalXp: 120,
    });

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /went/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /went/i }));

    await waitFor(() => {
      expect(screen.getByText(/Past Simple is used for finished actions/i)).toBeInTheDocument();
    });
  });

  it('11. should call onRefreshStats when answer is submitted', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });
    vi.spyOn(questionApi, 'submitAnswer').mockResolvedValue({
      isCorrect: true,
      correctAnswer: 'went',
      explanation: 'Good job',
      xpEarned: 15,
      streak: 1,
      totalXp: 100,
    });

    const onRefreshStats = vi.fn();
    renderPracticePage({ onRefreshStats });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /went/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /went/i }));

    await waitFor(() => {
      expect(onRefreshStats).toHaveBeenCalled();
    });
  });

  it('12. should show error alert when API fetch fails', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockRejectedValue(new Error('Network error'));

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByText(/Не удалось загрузить вопросы/i)).toBeInTheDocument();
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('13. should allow retry when error alert is shown', async () => {
    const getSpy = vi.spyOn(questionApi, 'getQuestions')
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        data: [mockQuestion],
        pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
      });

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /Повторить/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledTimes(2);
      expect(screen.getByText('She ___ to the cinema yesterday.')).toBeInTheDocument();
    });
  });

  it('14. should show empty state when no questions are available', async () => {
    vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [],
      pagination: { total: 0, page: 1, limit: 5, totalPages: 0 },
    });

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByText(/Пока нет вопросов для этой темы и уровня/i)).toBeInTheDocument();
    });
  });

  it('15. should render reload button to refresh questions', async () => {
    const getSpy = vi.spyOn(questionApi, 'getQuestions').mockResolvedValue({
      data: [mockQuestion],
      pagination: { total: 1, page: 1, limit: 5, totalPages: 1 },
    });

    renderPracticePage();

    await waitFor(() => {
      expect(screen.getByText('She ___ to the cinema yesterday.')).toBeInTheDocument();
    });

    const refreshBtn = screen.getByTitle('Обновить задания');
    fireEvent.click(refreshBtn);

    expect(getSpy).toHaveBeenCalledTimes(2);
  });
});
