import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FlashcardDeck, FlashcardItem } from '../ui/FlashcardDeck';
import { soundEffects } from '@/shared/lib/audio';
import { SRSEngine } from '@/shared/lib/srs';

const mockItems: FlashcardItem[] = [
  {
    id: 1,
    frontMain: 'apple',
    frontPhonetic: '/ˈæpl/',
    frontContext: 'I eat an apple daily.',
    backMain: 'яблоко',
    backDetail: 'Круглый сочный фрукт.',
    backGrammar: 'an apple (countable noun)',
    level: 'A1',
    category: 'food',
  },
  {
    id: 2,
    frontMain: 'banana',
    frontPhonetic: '/bəˈnɑːnə/',
    frontContext: 'Monkeys love bananas.',
    backMain: 'банан',
    backDetail: 'Желтый продолговатый фрукт.',
    level: 'A1',
    category: 'food',
  },
  {
    id: 3,
    frontMain: 'cherry',
    frontPhonetic: '/ˈtʃeri/',
    frontContext: 'Fresh sweet cherry.',
    backMain: 'вишня',
    backDetail: 'Маленькая красная ягода.',
    level: 'A1',
    category: 'food',
  },
];

describe('FlashcardDeck UI Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. should show empty state when items list is empty', () => {
    render(<FlashcardDeck items={[]} />);
    expect(screen.getByText(/Нет карточек для повторения/i)).toBeInTheDocument();
  });

  it('2. should render front face with word, phonetic, and context initially', () => {
    render(<FlashcardDeck items={mockItems} />);
    expect(screen.getByText('apple')).toBeInTheDocument();
    expect(screen.getByText('/ˈæpl/')).toBeInTheDocument();
    expect(screen.getByText(/"I eat an apple daily."/i)).toBeInTheDocument();
  });

  it('3. should render round counter and safe exit XP tag', () => {
    render(<FlashcardDeck items={mockItems} />);
    expect(screen.getByText(/Раунд 1: 1 из 3/i)).toBeInTheDocument();
    expect(screen.getByText(/\+0 XP сохранено/i)).toBeInTheDocument();
  });

  it('4. should render round mode selector with options 15, 30, 45, 60, Все', () => {
    render(<FlashcardDeck items={mockItems} />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText(/Все \(3\)/i)).toBeInTheDocument();
  });

  it('5. should flip card and show translation when clicking flip button', () => {
    render(<FlashcardDeck items={mockItems} />);
    const flipBtn = screen.getByRole('button', { name: /Показать ответ/i });
    fireEvent.click(flipBtn);

    expect(screen.getByText('яблоко')).toBeInTheDocument();
    expect(screen.getByText(/Круглый сочный фрукт/i)).toBeInTheDocument();
  });

  it('6. should flip card when Space key is pressed', () => {
    render(<FlashcardDeck items={mockItems} />);
    fireEvent.keyDown(window, { code: 'Space' });

    expect(screen.getByText('яблоко')).toBeInTheDocument();
  });

  it('7. should render 4 SRS rating buttons with shortcuts when flipped', () => {
    render(<FlashcardDeck items={mockItems} />);
    fireEvent.keyDown(window, { code: 'Space' });

    expect(screen.getByText('Снова')).toBeInTheDocument();
    expect(screen.getByText('Трудно')).toBeInTheDocument();
    expect(screen.getByText('Хорошо')).toBeInTheDocument();
    expect(screen.getByText('Легко')).toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
    expect(screen.getByText('[2]')).toBeInTheDocument();
    expect(screen.getByText('[3]')).toBeInTheDocument();
    expect(screen.getByText('[4]')).toBeInTheDocument();
  });

  it('8. should call SRSEngine.syncReviewWithServer when rating button clicked', () => {
    const syncSpy = vi.spyOn(SRSEngine, 'syncReviewWithServer').mockImplementation(() => {});
    render(<FlashcardDeck items={mockItems} />);
    fireEvent.keyDown(window, { code: 'Space' });

    const goodBtn = screen.getByText('Хорошо').closest('button');
    expect(goodBtn).not.toBeNull();
    fireEvent.click(goodBtn!);

    expect(syncSpy).toHaveBeenCalledWith(1, 3, 'cards');
  });

  it('9. should handle shortcut keys 1-4 to rate card when flipped', () => {
    const syncSpy = vi.spyOn(SRSEngine, 'syncReviewWithServer').mockImplementation(() => {});
    render(<FlashcardDeck items={mockItems} />);
    fireEvent.keyDown(window, { code: 'Space' });

    fireEvent.keyDown(window, { key: '4' });
    expect(syncSpy).toHaveBeenCalledWith(1, 4, 'cards');
  });

  it('10. should re-insert card at end of round when rated Снова (1)', () => {
    render(<FlashcardDeck items={mockItems} />);
    fireEvent.keyDown(window, { code: 'Space' });

    // Rate card 1 as "Снова"
    fireEvent.keyDown(window, { key: '1' });

    // Round total should increase from 3 to 4 cards
    expect(screen.getByText(/Раунд 1: 2 из 4/i)).toBeInTheDocument();
  });

  it('11. should advance to next card after rating', () => {
    render(<FlashcardDeck items={mockItems} />);
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { key: '3' });

    // Now showing second card 'banana'
    expect(screen.getByText('banana')).toBeInTheDocument();
    expect(screen.getByText(/Раунд 1: 2 из 3/i)).toBeInTheDocument();
  });

  it('12. should speak pronunciation when sound button is clicked', () => {
    const speakSpy = vi.spyOn(soundEffects, 'speak').mockImplementation(() => {});
    render(<FlashcardDeck items={mockItems} />);

    const soundButtons = screen.getAllByTitle('Озвучить');
    fireEvent.click(soundButtons[0]);

    expect(speakSpy).toHaveBeenCalledWith('apple');
  });

  it('13. should hide answer when clicking Скрыть ответ button', () => {
    render(<FlashcardDeck items={mockItems} />);
    fireEvent.keyDown(window, { code: 'Space' });

    const hideBtn = screen.getByRole('button', { name: /Скрыть ответ/i });
    fireEvent.click(hideBtn);

    // Front flip button returns
    expect(screen.getByRole('button', { name: /Показать ответ/i })).toBeInTheDocument();
  });

  it('14. should show celebratory round finished screen when last card is answered', () => {
    render(<FlashcardDeck items={[mockItems[0]]} />);
    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { key: '3' });

    expect(screen.getByText(/Колода полностью завершена!|Раунд 1 пройден!/i)).toBeInTheDocument();
    expect(screen.getByText(/Усвоено в раунде/i)).toBeInTheDocument();
    expect(screen.getByText(/Опыт за раунд/i)).toBeInTheDocument();
  });

  it('15. should call onFinish callback when deck is fully completed', () => {
    const onFinish = vi.fn();
    render(<FlashcardDeck items={[mockItems[0]]} onFinish={onFinish} />);

    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { key: '3' });

    expect(onFinish).toHaveBeenCalledWith(1, 1);
  });
});
