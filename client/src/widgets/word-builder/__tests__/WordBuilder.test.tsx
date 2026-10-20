import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WordBuilder } from '../ui/WordBuilder';
import { DictionaryItem } from '@/entities/dictionary';
import { soundEffects } from '@/shared/lib/audio';

const mockWords: DictionaryItem[] = [
  {
    id: 1,
    word: 'cat',
    transcription: '/kæt/',
    translation: 'кот',
    definition: 'A small domesticated feline mammal.',
    level: 'A1',
    section_id: 'general',
  },
  {
    id: 2,
    word: 'dog',
    transcription: '/dɒɡ/',
    translation: 'собака',
    definition: 'A domesticated canine mammal.',
    level: 'A1',
    section_id: 'general',
  },
  {
    id: 3,
    word: 'bird',
    transcription: '/bɜːd/',
    translation: 'птица',
    definition: 'A feathered vertebrate.',
    level: 'A1',
    section_id: 'general',
  },
];

describe('WordBuilder UI Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should show empty state when words list is empty', () => {
    render(<WordBuilder words={[]} />);
    expect(screen.getByText(/Слова не найдены/i)).toBeInTheDocument();
  });

  it('2. should render target word translation and level tag', () => {
    render(<WordBuilder words={mockWords} />);
    // The first word in batch will be displayed
    expect(screen.getByText(/кот|собака|птица/i)).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
  });

  it('3. should render word definition context', () => {
    render(<WordBuilder words={[mockWords[0]]} />);
    expect(screen.getByText(/"A small domesticated feline mammal."/i)).toBeInTheDocument();
  });

  it('4. should render letter tiles in scrambled pool matching word letters', () => {
    const { container } = render(<WordBuilder words={[mockWords[0]]} />);
    // Word is 'cat', letters: c, a, t
    const availableTiles = container.querySelectorAll('.availableTile');
    expect(availableTiles.length).toBe(3);
  });

  it('5. should place tile into assembled area when clicked', () => {
    const { container } = render(<WordBuilder words={[mockWords[0]]} />);
    const availableTiles = container.querySelectorAll('.availableTile');
    expect(availableTiles.length).toBe(3);

    fireEvent.click(availableTiles[0]);
    const assembledTiles = container.querySelectorAll('.assembledTile');
    expect(assembledTiles.length).toBe(1);
  });

  it('6. should remove assembled tile when clicked and return it to available pool', () => {
    const { container } = render(<WordBuilder words={[mockWords[0]]} />);
    const firstTile = container.querySelector('.availableTile') as HTMLElement;
    fireEvent.click(firstTile);

    let assembled = container.querySelectorAll('.assembledTile');
    expect(assembled.length).toBe(1);

    fireEvent.click(assembled[0]);
    assembled = container.querySelectorAll('.assembledTile');
    expect(assembled.length).toBe(0);
  });

  it('7. should handle keyboard typing matching letter to select tile', () => {
    const { container } = render(<WordBuilder words={[mockWords[0]]} />);
    fireEvent.keyDown(window, { key: 'c' });

    const assembled = container.querySelectorAll('.assembledTile');
    expect(assembled.length).toBe(1);
    expect(assembled[0].textContent).toBe('c');
  });

  it('8. should handle backspace key to remove the last assembled letter', () => {
    const { container } = render(<WordBuilder words={[mockWords[0]]} />);
    fireEvent.keyDown(window, { key: 'c' });
    expect(container.querySelectorAll('.assembledTile').length).toBe(1);

    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(container.querySelectorAll('.assembledTile').length).toBe(0);
  });

  it('9. should reset assembled letters when clicking Сбросить button', () => {
    const { container } = render(<WordBuilder words={[mockWords[0]]} />);
    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: 'a' });
    expect(container.querySelectorAll('.assembledTile').length).toBe(2);

    const resetBtn = screen.getByRole('button', { name: /Сбросить/i });
    fireEvent.click(resetBtn);

    expect(container.querySelectorAll('.assembledTile').length).toBe(0);
  });

  it('10. should automatically select the next correct tile when clicking Подсказка', () => {
    const { container } = render(<WordBuilder words={[mockWords[0]]} />);
    const hintBtn = screen.getByRole('button', { name: /Подсказка/i });
    fireEvent.click(hintBtn);

    const assembled = container.querySelectorAll('.assembledTile');
    expect(assembled.length).toBe(1);
    expect(assembled[0].textContent).toBe('c');
  });

  it('11. should validate correct word assembly and show next/finish button', () => {
    render(<WordBuilder words={[mockWords[0]]} />);
    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 't' });

    // When correct, next button appears
    expect(screen.getByRole('button', { name: /Завершить|Следующее слово/i })).toBeInTheDocument();
  });

  it('12. should mark assembly area with error style on wrong word', () => {
    const { container } = render(<WordBuilder words={[mockWords[0]]} />);
    fireEvent.keyDown(window, { key: 't' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'c' });

    const assemblyArea = container.querySelector('.assemblyArea');
    expect(assemblyArea?.className).toMatch(/wrong/);
  });

  it('13. should call onComplete and display finish screen when last word is done', () => {
    const onComplete = vi.fn();
    render(<WordBuilder words={[mockWords[0]]} onComplete={onComplete} />);

    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 't' });

    const finishBtn = screen.getByRole('button', { name: /Завершить/i });
    fireEvent.click(finishBtn);

    expect(screen.getByText(/Спеллинг-тренировка завершена!/i)).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(1, 1, 20);
  });

  it('14. should speak word when audio button is clicked', () => {
    const speakSpy = vi.spyOn(soundEffects, 'speak').mockImplementation(() => {});
    render(<WordBuilder words={[mockWords[0]]} />);

    const soundBtn = screen.getByTitle('Прослушать произношение');
    fireEvent.click(soundBtn);

    expect(speakSpy).toHaveBeenCalledWith('cat');
  });

  it('15. should call onClose when closing from finish screen', () => {
    const onClose = vi.fn();
    render(<WordBuilder words={[mockWords[0]]} onClose={onClose} />);

    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 't' });

    const finishBtn = screen.getByRole('button', { name: /Завершить/i });
    fireEvent.click(finishBtn);

    const closeBtn = screen.getByRole('button', { name: /Вернуться/i });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
