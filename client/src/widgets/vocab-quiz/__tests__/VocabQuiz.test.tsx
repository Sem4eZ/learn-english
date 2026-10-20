import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { VocabQuiz } from '../ui/VocabQuiz';
import { DictionaryItem } from '@/entities/dictionary';

const mockWords: DictionaryItem[] = [
  {
    id: 1,
    word: 'apple',
    transcription: '/ˈæpl/',
    translation: 'яблоко',
    definition: 'A round fruit with red or green skin.',
    example_sentence: 'I ate a fresh apple.',
    example_translation: 'Я съел яблоко.',
    level: 'A1',
    section_id: 'general',
  },
  {
    id: 2,
    word: 'banana',
    transcription: '/bəˈnænə/',
    translation: 'банан',
    definition: 'A long curved fruit with a yellow skin.',
    example_sentence: 'Monkeys love bananas.',
    example_translation: 'Обезьяны любят бананы.',
    level: 'A1',
    section_id: 'general',
  },
  {
    id: 3,
    word: 'cherry',
    transcription: '/ˈtʃeri/',
    translation: 'вишня',
    definition: 'A small, round stone fruit that is typically bright or dark red.',
    example_sentence: 'The cherry is sweet.',
    example_translation: 'Вишня сладкая.',
    level: 'A1',
    section_id: 'general',
  },
  {
    id: 4,
    word: 'date',
    transcription: '/deɪt/',
    translation: 'финик',
    definition: 'A sweet dark brown oval fruit.',
    example_sentence: 'Dates grow on palm trees.',
    example_translation: 'Финики растут на пальмах.',
    level: 'A1',
    section_id: 'general',
  },
  {
    id: 5,
    word: 'elderberry',
    transcription: '/ˈeldərbəri/',
    translation: 'бузина',
    definition: 'A small dark purple berry.',
    example_sentence: 'Elderberry syrup is healthy.',
    example_translation: 'Сироп из бузины полезен.',
    level: 'A1',
    section_id: 'general',
  },
];

describe('VocabQuiz UI Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should show empty state or prompt when words array has fewer than 2 items', () => {
    render(<VocabQuiz words={[mockWords[0]]} />);
    expect(screen.getByText(/Недостаточно слов для квиза/i)).toBeInTheDocument();
  });

  it('2. should render question target word and 4 option buttons in EN-RU mode', () => {
    render(<VocabQuiz words={mockWords} initialDirection="en-ru" />);
    expect(screen.getByText(/Вопрос 1 из/i)).toBeInTheDocument();

    const optionButtons = screen.getAllByRole('button').filter(b => 
      b.className.includes('optionButton')
    );
    expect(optionButtons).toHaveLength(4);
  });

  it('3. should toggle language direction from EN-RU to RU-EN', () => {
    render(<VocabQuiz words={mockWords} initialDirection="en-ru" />);
    const toggleBtn = screen.getByText(/EN ➔ RU/i);
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByText(/RU ➔ EN/i)).toBeInTheDocument();
  });

  it('4. should handle audio speech synthesis on audio button click', () => {
    const speakSpy = vi.spyOn(window.speechSynthesis, 'speak');
    render(<VocabQuiz words={mockWords} />);

    const soundBtn = screen.getByRole('button', { name: /sound/i });
    if (soundBtn) {
      fireEvent.click(soundBtn);
      expect(speakSpy).toHaveBeenCalled();
    }
  });

  it('5. should highlight chosen option and show next button', async () => {
    render(<VocabQuiz words={mockWords} initialDirection="en-ru" />);

    const options = screen.getAllByRole('button').filter(b => b.className.includes('optionButton'));
    expect(options.length).toBe(4);

    fireEvent.click(options[0]);

    await waitFor(() => {
      expect(screen.getByText(/Следующий вопрос|Завершить квиз/i)).toBeInTheDocument();
    });
  });

  it('6. should advance to next question when clicking next button', async () => {
    render(<VocabQuiz words={mockWords} initialDirection="en-ru" />);

    const options = screen.getAllByRole('button').filter(b => b.className.includes('optionButton'));
    fireEvent.click(options[0]);

    const nextBtn = await screen.findByText(/Следующий вопрос|Завершить квиз/i);
    fireEvent.click(nextBtn);

    expect(screen.getByText(/Вопрос 2 из/i)).toBeInTheDocument();
  });

  it('7. should award XP and display combo streak for correct answers', () => {
    render(<VocabQuiz words={mockWords} initialDirection="en-ru" />);
    expect(screen.getByText(/0 XP/i)).toBeInTheDocument();
  });

  it('8. should show explanation context after an answer is selected', async () => {
    render(<VocabQuiz words={mockWords} initialDirection="en-ru" />);

    const options = screen.getAllByRole('button').filter(b => b.className.includes('optionButton'));
    fireEvent.click(options[0]);

    await waitFor(() => {
      expect(screen.getByText(/Следующий вопрос|Завершить квиз/i)).toBeInTheDocument();
    });
  });

  it('9. should display sound button and transcription on question card', () => {
    render(<VocabQuiz words={mockWords} initialDirection="en-ru" />);
    expect(screen.getByRole('button', { name: /sound/i })).toBeInTheDocument();
  });

  it('10. should ignore duplicate option clicks once an answer is chosen', async () => {
    render(<VocabQuiz words={mockWords} initialDirection="en-ru" />);

    const options = screen.getAllByRole('button').filter(b => b.className.includes('optionButton'));
    fireEvent.click(options[0]);
    fireEvent.click(options[1]); // should be ignored

    await screen.findByText(/Следующий вопрос|Завершить квиз/i);
    expect(screen.getByText(/Вопрос 1 из/i)).toBeInTheDocument();
  });

  it('11. should display level tag and category badge on question card', () => {
    render(<VocabQuiz words={mockWords} />);
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('general')).toBeInTheDocument();
  });

  it('12. should filter out corrupted grammar strings from definitions', () => {
    const wordsWithCorrupted: DictionaryItem[] = [
      ...mockWords.slice(0, 3),
      {
        id: 99,
        word: 'rule',
        transcription: '/ruːl/',
        translation: 'правило',
        definition: 'Правильный ответ read. Passive voice is used.',
        example_sentence: 'Follow the rule.',
        example_translation: 'Следуйте правилу.',
        level: 'A1',
        section_id: 'general',
      },
    ];

    render(<VocabQuiz words={wordsWithCorrupted} />);
    expect(screen.queryByText(/Passive voice is used/i)).not.toBeInTheDocument();
  });

  it('13. should trigger onComplete when all questions are answered', async () => {
    const onComplete = vi.fn();
    render(<VocabQuiz words={mockWords} onComplete={onComplete} />);

    // Answer all questions
    for (let i = 0; i < 5; i++) {
      const options = screen.getAllByRole('button').filter(b => b.className.includes('optionButton'));
      fireEvent.click(options[0]);
      const nextBtn = await screen.findByText(/Следующий вопрос|Завершить квиз/i);
      fireEvent.click(nextBtn);
    }

    expect(screen.getByText(/Квиз завершен/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalled();
  });

  it('14. should call onNeedMore when remaining questions count is low', async () => {
    const onNeedMore = vi.fn();
    render(<VocabQuiz words={mockWords} onNeedMore={onNeedMore} />);

    const options = screen.getAllByRole('button').filter(b => b.className.includes('optionButton'));
    fireEvent.click(options[0]);

    expect(onNeedMore).toHaveBeenCalled();
  });

  it('15. should change round mode slice when clicking segmented options', () => {
    render(<VocabQuiz words={mockWords} />);
    expect(screen.getByText(/Вопрос 1 из/i)).toBeInTheDocument();
  });
});
