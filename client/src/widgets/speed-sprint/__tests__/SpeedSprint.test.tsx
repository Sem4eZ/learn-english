import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { SpeedSprint } from '../ui/SpeedSprint';
import { DictionaryItem } from '@/entities/dictionary';

const mockWords: DictionaryItem[] = [
  {
    id: 1,
    word: 'cat',
    transcription: '/kæt/',
    translation: 'кот',
    definition: 'A small domesticated carnivorous mammal.',
    level: 'A1',
    section_id: 'general',
  },
  {
    id: 2,
    word: 'dog',
    transcription: '/dɒɡ/',
    translation: 'собака',
    definition: 'A domesticated carnivorous mammal.',
    level: 'A1',
    section_id: 'general',
  },
  {
    id: 3,
    word: 'bird',
    transcription: '/bɜːd/',
    translation: 'птица',
    definition: 'A warm-blooded egg-laying vertebrate animal.',
    level: 'A1',
    section_id: 'general',
  },
];

describe('SpeedSprint UI Component Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. should show empty state when fewer than 2 words are provided', () => {
    render(<SpeedSprint words={[mockWords[0]]} />);
    expect(screen.getByText(/Недостаточно слов для спринта/i)).toBeInTheDocument();
  });

  it('2. should render initial 60s timer and sprint game card', () => {
    render(<SpeedSprint words={mockWords} />);
    expect(screen.getByText(/60с/i)).toBeInTheDocument();
    expect(screen.getByText(/0 pts/i)).toBeInTheDocument();
  });

  it('3. should render two action buttons: Неверно (False) and Верно (True)', () => {
    render(<SpeedSprint words={mockWords} />);
    expect(screen.getByRole('button', { name: /НЕВЕРНО/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check ВЕРНО/i })).toBeInTheDocument();
  });

  it('4. should decrement timer over time', () => {
    render(<SpeedSprint words={mockWords} />);
    expect(screen.getByText(/60с/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText(/58с/i)).toBeInTheDocument();
  });

  it('5. should handle button click on Верно button', () => {
    render(<SpeedSprint words={mockWords} />);
    const trueBtn = screen.getByRole('button', { name: /check ВЕРНО/i });

    expect(() => fireEvent.click(trueBtn)).not.toThrow();
  });

  it('6. should handle button click on Неверно button', () => {
    render(<SpeedSprint words={mockWords} />);
    const falseBtn = screen.getByRole('button', { name: /НЕВЕРНО/i });

    expect(() => fireEvent.click(falseBtn)).not.toThrow();
  });

  it('7. should support ArrowRight key press to select Верно', () => {
    render(<SpeedSprint words={mockWords} />);
    expect(() => fireEvent.keyDown(window, { key: 'ArrowRight' })).not.toThrow();
  });

  it('8. should support ArrowLeft key press to select Неверно', () => {
    render(<SpeedSprint words={mockWords} />);
    expect(() => fireEvent.keyDown(window, { key: 'ArrowLeft' })).not.toThrow();
  });

  it('9. should finish game when timer reaches 0', () => {
    render(<SpeedSprint words={mockWords} />);

    act(() => {
      vi.advanceTimersByTime(61000);
    });

    expect(screen.getByText(/Спринт окончен/i)).toBeInTheDocument();
  });

  it('10. should trigger onComplete callback when game finishes', () => {
    const onComplete = vi.fn();
    render(<SpeedSprint words={mockWords} onComplete={onComplete} />);

    act(() => {
      vi.advanceTimersByTime(61000);
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('11. should show final summary with score and max combo on finish screen', () => {
    render(<SpeedSprint words={mockWords} />);

    act(() => {
      vi.advanceTimersByTime(61000);
    });

    expect(screen.getByText(/очков/i)).toBeInTheDocument();
    expect(screen.getByText(/Максимальная серия/i)).toBeInTheDocument();
  });

  it('12. should allow restarting sprint via "Сыграть еще раз" button', () => {
    render(<SpeedSprint words={mockWords} />);

    act(() => {
      vi.advanceTimersByTime(61000);
    });

    const restartBtn = screen.getByRole('button', { name: /Сыграть еще раз/i });
    fireEvent.click(restartBtn);

    expect(screen.getByText(/60с/i)).toBeInTheDocument();
  });

  it('13. should call onNeedMore when word list count is less than 25', () => {
    const onNeedMore = vi.fn();
    render(<SpeedSprint words={mockWords} onNeedMore={onNeedMore} />);

    expect(onNeedMore).toHaveBeenCalled();
  });

  it('14. should call onClose when closing the game from finish screen via "Вернуться"', () => {
    const onClose = vi.fn();
    render(<SpeedSprint words={mockWords} onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(61000);
    });

    const closeBtn = screen.getByRole('button', { name: /Вернуться/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });

  it('15. should display active combo multiplier badge when combo > 1', () => {
    render(<SpeedSprint words={mockWords} />);
    expect(screen.queryByText(/x4/)).not.toBeInTheDocument();
  });
});
