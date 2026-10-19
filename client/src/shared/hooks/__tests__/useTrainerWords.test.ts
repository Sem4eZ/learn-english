import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useTrainerWords } from '../useTrainerWords';
import { dictionaryApi } from '@/entities/dictionary/api/dictionaryApi';
import { DictionaryItem } from '@/entities/dictionary/model/types';

const mockWords: DictionaryItem[] = [
  {
    id: 1,
    word: 'apple',
    transcription: '/ˈæpl/',
    translation: 'яблоко',
    definition: 'A round fruit with red or green skin.',
    example_sentence: 'I ate a fresh apple.',
    example_translation: 'Я съел свежее яблоко.',
    level: 'A1',
    section_id: 'general',
  },
  {
    id: 2,
    word: 'book',
    transcription: '/bʊk/',
    translation: 'книга',
    definition: 'A written work published in printed or digital form.',
    example_sentence: 'She is reading a captivating book.',
    example_translation: 'Она читает увлекательную книгу.',
    level: 'A1',
    section_id: 'general',
  },
];

describe('useTrainerWords Hook Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(MemoryRouter, { initialEntries: ['/trainers/quiz?level=A1&category=general'] }, children)
  );

  it('1. should initialize with default parameters and start loading', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: mockWords,
      pagination: { total: 2, totalInDb: 2, isCramMode: false },
    } as any);

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.level).toBe('A1');
    expect(result.current.category).toBe('general');

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.words).toHaveLength(2);
    expect(result.current.words[0].word).toBe('apple');
  });

  it('2. should read level and category from URL query parameters', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0, isCramMode: false },
    } as any);

    const customWrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(MemoryRouter, { initialEntries: ['/trainers/quiz?level=B2&category=tech_it'] }, children)
    );

    const { result } = renderHook(() => useTrainerWords(), { wrapper: customWrapper });

    expect(result.current.level).toBe('B2');
    expect(result.current.category).toBe('tech_it');
  });

  it('3. should fall back to options.initialLevel and options.initialCategory when no URL params exist', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { total: 0 },
    } as any);

    const emptyWrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(MemoryRouter, { initialEntries: ['/trainers/quiz'] }, children)
    );

    const { result } = renderHook(
      () => useTrainerWords({ initialLevel: 'C1', initialCategory: 'business' }),
      { wrapper: emptyWrapper }
    );

    expect(result.current.level).toBe('C1');
    expect(result.current.category).toBe('business');
  });

  it('4. should trigger cram mode fallback when practice mode returns 0 words', async () => {
    const getDictSpy = vi.spyOn(dictionaryApi, 'getDictionary')
      .mockResolvedValueOnce({ success: true, data: [], pagination: { total: 0 } } as any)
      .mockResolvedValueOnce({
        success: true,
        data: mockWords,
        pagination: { total: 2, isCramMode: true },
      } as any);

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getDictSpy).toHaveBeenCalledTimes(2);
    expect(result.current.isCramMode).toBe(true);
    expect(result.current.words).toHaveLength(2);
  });

  it('5. should transform dictionary items into FlashcardItem objects', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: mockWords,
      pagination: { total: 2 },
    } as any);

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.cardItems).toHaveLength(2);
    const item1 = result.current.cardItems.find(c => c.id === 1);
    expect(item1).toEqual({
      id: 1,
      frontMain: 'apple',
      frontPhonetic: '/ˈæpl/',
      frontContext: 'I ate a fresh apple.',
      backMain: 'яблоко',
      backDetail: 'A round fruit with red or green skin.',
      backGrammar: 'Я съел свежее яблоко.',
      category: 'general',
      level: 'A1',
    });
  });

  it('6. should transform dictionary items into AudioItem objects', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: mockWords,
      pagination: { total: 2 },
    } as any);

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.audioItems).toHaveLength(2);
    const audio1 = result.current.audioItems.find(a => a.id === 1);
    expect(audio1).toEqual({
      id: 1,
      sentence: 'I ate a fresh apple.',
      translation: 'Я съел свежее яблоко.',
      hint: 'A round fruit with red or green skin.',
      level: 'A1',
    });
  });

  it('7. should trigger auto-replenishment when fetched words count is below 20', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: mockWords,
      pagination: { total: 2 },
    } as any);

    const genWordsSpy = vi.spyOn(dictionaryApi, 'generateWords').mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 3,
          word: 'cat',
          transcription: '/kæt/',
          translation: 'кот',
          definition: 'A small domesticated carnivorous mammal.',
          example_sentence: 'The cat is sleeping.',
          example_translation: 'Кот спит.',
          level: 'A1',
          section_id: 'general',
        },
      ],
      message: 'Generated 1 word',
    } as any);

    renderHook(() => useTrainerWords(), { wrapper });

    await waitFor(() => {
      expect(genWordsSpy).toHaveBeenCalledWith('A1', 'general', 35);
    });
  });

  it('8. should prevent concurrent duplicate replenishment calls', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValue({
      success: true,
      data: mockWords,
      pagination: { total: 2 },
    } as any);

    const genSpy = vi.spyOn(dictionaryApi, 'generateWords').mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ success: true, data: [] } as any), 50))
    );

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    await act(async () => {
      const p1 = result.current.handleNeedMoreWords(35);
      const p2 = result.current.handleNeedMoreWords(35);
      await Promise.all([p1, p2]);
    });

    expect(genSpy).toHaveBeenCalledTimes(1);
  });

  it('9. handleGameComplete should call onRefreshStats and refresh words', async () => {
    const onRefreshStats = vi.fn();
    const getDictSpy = vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValue({
      success: true,
      data: mockWords,
      pagination: { total: 2 },
    } as any);

    const { result } = renderHook(() => useTrainerWords({ onRefreshStats }), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleGameComplete(50);
    });

    expect(onRefreshStats).toHaveBeenCalledTimes(1);
    expect(getDictSpy).toHaveBeenCalledTimes(2);
  });

  it('10. handleGameComplete should not trigger onRefreshStats if xpEarned is 0', async () => {
    const onRefreshStats = vi.fn();
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValue({
      success: true,
      data: mockWords,
      pagination: { total: 2 },
    } as any);

    const { result } = renderHook(() => useTrainerWords({ onRefreshStats }), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleGameComplete(0);
    });

    expect(onRefreshStats).not.toHaveBeenCalled();
  });

  it('11. should handle fetch errors gracefully and reset loading', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.words).toEqual([]);
  });

  it('12. should append fresh words without duplicates when handleNeedMoreWords returns data', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: mockWords,
      pagination: { total: 2 },
    } as any);

    vi.spyOn(dictionaryApi, 'generateWords').mockResolvedValueOnce({
      success: true,
      data: [
        mockWords[0], // Duplicate (id: 1)
        {
          id: 4,
          word: 'dog',
          transcription: '/dɒɡ/',
          translation: 'собака',
          definition: 'A domesticated carnivorous mammal.',
          example_sentence: 'The dog barked.',
          example_translation: 'Собака залаяла.',
          level: 'A1',
          section_id: 'general',
        },
      ],
      message: 'Generated words',
    } as any);

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.handleNeedMoreWords(35);
    });

    expect(result.current.words).toHaveLength(3);
    expect(result.current.words.map(w => w.id)).toEqual([1, 2, 4]);
  });

  it('13. should handle empty response from generateWords gracefully', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: mockWords,
      pagination: { total: 2 },
    } as any);

    vi.spyOn(dictionaryApi, 'generateWords').mockResolvedValueOnce({
      success: false,
      data: [],
    } as any);

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let res: any;
    await act(async () => {
      res = await result.current.handleNeedMoreWords(35);
    });

    expect(res).toEqual([]);
    expect(result.current.words).toHaveLength(2);
  });

  it('14. should fall back to word if example_sentence is missing in audioItems', async () => {
    const wordWithoutExample: DictionaryItem = {
      id: 5,
      word: 'silent',
      transcription: '/ˈsaɪlənt/',
      translation: 'тихий',
      definition: 'Not making or accompanied by any sound.',
      level: 'A1',
      section_id: 'general',
    };

    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: [wordWithoutExample],
      pagination: { total: 1 },
    } as any);

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.audioItems).toHaveLength(1);
    expect(result.current.audioItems[0].sentence).toBe('silent');
  });

  it('15. totalInDb correctly reflects pagination info', async () => {
    vi.spyOn(dictionaryApi, 'getDictionary').mockResolvedValueOnce({
      success: true,
      data: mockWords,
      pagination: { totalInDb: 737 },
    } as any);

    const { result } = renderHook(() => useTrainerWords(), { wrapper });

    await waitFor(() => {
      expect(result.current.totalInDb).toBe(737);
    });
  });
});
