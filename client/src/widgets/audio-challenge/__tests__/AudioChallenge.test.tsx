import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { AudioChallenge, AudioItem } from '../ui/AudioChallenge';
import { soundEffects } from '@/shared/lib/audio';

const mockItems: AudioItem[] = [
  {
    id: 1,
    sentence: 'The cat sleeps on the mat.',
    translation: 'Кот спит на коврике.',
    level: 'A1',
  },
  {
    id: 2,
    sentence: 'I drink water every day.',
    translation: 'Я пью воду каждый день.',
    level: 'A1',
  },
];

describe('AudioChallenge UI Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. should show empty state when items list is empty', () => {
    render(<AudioChallenge items={[]} />);
    expect(screen.getByText(/Нет доступных заданий по аудированию/i)).toBeInTheDocument();
  });

  it('2. should render initial status bar, progress and title', () => {
    render(<AudioChallenge items={mockItems} />);
    expect(screen.getByText(/Аудиозадание 1 из 2/i)).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText(/Послушайте фразу и соберите предложение/i)).toBeInTheDocument();
  });

  it('3. should render speed toggle buttons (1.0x and 0.75x)', () => {
    render(<AudioChallenge items={mockItems} />);
    expect(screen.getByRole('button', { name: /1\.0x/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /0\.75x/i })).toBeInTheDocument();
  });

  it('4. should render word chips corresponding to the sentence', () => {
    const { container } = render(<AudioChallenge items={mockItems} />);
    const chips = container.querySelectorAll('.wordChip');
    // Sentence: 'The cat sleeps on the mat.' -> 6 words
    expect(chips.length).toBe(6);
  });

  it('5. should move chip to answer area when clicked', () => {
    const { container } = render(<AudioChallenge items={mockItems} />);
    const firstChip = container.querySelector('.wordChip') as HTMLElement;
    const wordText = firstChip.textContent?.trim();

    fireEvent.click(firstChip);

    const selectedChips = container.querySelectorAll('.selectedWordChip');
    expect(selectedChips.length).toBe(1);
    expect(selectedChips[0].textContent).toBe(wordText);
  });

  it('6. should return chip to pool when clicked inside answer area', () => {
    const { container } = render(<AudioChallenge items={mockItems} />);
    const firstChip = container.querySelector('.wordChip') as HTMLElement;
    fireEvent.click(firstChip);

    let selectedChips = container.querySelectorAll('.selectedWordChip');
    expect(selectedChips.length).toBe(1);

    fireEvent.click(selectedChips[0]);
    selectedChips = container.querySelectorAll('.selectedWordChip');
    expect(selectedChips.length).toBe(0);
  });

  it('7. should call soundEffects.speak when clicking big play button', () => {
    const speakSpy = vi.spyOn(soundEffects, 'speak').mockImplementation(() => {});
    render(<AudioChallenge items={mockItems} />);

    // Fast-forward initial auto-play timer
    act(() => {
      vi.runAllTimers();
    });
    speakSpy.mockClear();

    const playBtn = screen.getByRole('button', { name: /customer-service/i });
    fireEvent.click(playBtn);

    expect(speakSpy).toHaveBeenCalledWith('The cat sleeps on the mat.', expect.objectContaining({ rate: 0.95 }));
  });

  it('8. should switch to 0.75x slow playback speed', () => {
    const speakSpy = vi.spyOn(soundEffects, 'speak').mockImplementation(() => {});
    render(<AudioChallenge items={mockItems} />);

    act(() => {
      vi.runAllTimers();
    });
    speakSpy.mockClear();

    const slowBtn = screen.getByRole('button', { name: /0\.75x/i });
    fireEvent.click(slowBtn);

    expect(speakSpy).toHaveBeenCalledWith('The cat sleeps on the mat.', expect.objectContaining({ rate: 0.72 }));
  });

  it('9. should keep Проверить button disabled when no words are selected', () => {
    render(<AudioChallenge items={mockItems} />);
    const verifyBtn = screen.getByRole('button', { name: /Проверить/i });
    expect(verifyBtn).toBeDisabled();
  });

  it('10. should enable Проверить button after selecting at least one word', () => {
    const { container } = render(<AudioChallenge items={mockItems} />);
    const firstChip = container.querySelector('.wordChip') as HTMLElement;
    fireEvent.click(firstChip);

    const verifyBtn = screen.getByRole('button', { name: /Проверить/i });
    expect(verifyBtn).toBeEnabled();
  });

  it('11. should reset selected words when clicking Сбросить', () => {
    const { container } = render(<AudioChallenge items={mockItems} />);
    const firstChip = container.querySelector('.wordChip') as HTMLElement;
    fireEvent.click(firstChip);

    const resetBtn = screen.getByRole('button', { name: /Сбросить/i });
    fireEvent.click(resetBtn);

    const selectedChips = container.querySelectorAll('.selectedWordChip');
    expect(selectedChips.length).toBe(0);
  });

  it('12. should show success feedback and next button on correct answer', () => {
    const { container } = render(<AudioChallenge items={mockItems} />);
    // Target tokens: The cat sleeps on the mat
    const expected = ['The', 'cat', 'sleeps', 'on', 'the', 'mat'];

    expected.forEach(word => {
      const chip = Array.from(container.querySelectorAll('.wordChip')).find(el => el.textContent?.trim().toLowerCase() === word.toLowerCase());
      if (chip) fireEvent.click(chip);
    });

    const verifyBtn = screen.getByRole('button', { name: /Проверить/i });
    fireEvent.click(verifyBtn);

    expect(screen.getByText(/Отлично! Вы верно собрали предложение/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Следующее ➔/i })).toBeInTheDocument();
  });

  it('13. should show error feedback on incorrect answer', () => {
    const { container } = render(<AudioChallenge items={mockItems} />);
    // Select just one word
    const firstChip = container.querySelector('.wordChip') as HTMLElement;
    fireEvent.click(firstChip);

    const verifyBtn = screen.getByRole('button', { name: /Проверить/i });
    fireEvent.click(verifyBtn);

    expect(screen.getByText(/Не совсем точно/i)).toBeInTheDocument();
    expect(screen.getByText(/Кот спит на коврике/i)).toBeInTheDocument();
  });

  it('14. should advance to next question when clicking Следующее ➔', () => {
    const { container } = render(<AudioChallenge items={mockItems} />);
    const firstChip = container.querySelector('.wordChip') as HTMLElement;
    fireEvent.click(firstChip);

    const verifyBtn = screen.getByRole('button', { name: /Проверить/i });
    fireEvent.click(verifyBtn);

    const nextBtn = screen.getByRole('button', { name: /Следующее ➔/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Аудиозадание 2 из 2/i)).toBeInTheDocument();
  });

  it('15. should trigger finish screen and onComplete callback after completing all items', () => {
    const onComplete = vi.fn();
    const { container } = render(<AudioChallenge items={[mockItems[0]]} onComplete={onComplete} />);

    // Select all correct words
    const expected = ['The', 'cat', 'sleeps', 'on', 'the', 'mat'];
    expected.forEach(word => {
      const chip = Array.from(container.querySelectorAll('.wordChip')).find(el => el.textContent?.trim().toLowerCase() === word.toLowerCase());
      if (chip) fireEvent.click(chip);
    });

    const verifyBtn = screen.getByRole('button', { name: /Проверить/i });
    fireEvent.click(verifyBtn);

    const nextBtn = screen.getByRole('button', { name: /Следующее ➔/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Аудиотренировка завершена!/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(40);
  });
});
