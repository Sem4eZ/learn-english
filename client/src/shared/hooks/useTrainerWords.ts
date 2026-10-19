import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import { DictionaryItem } from '@/entities/dictionary/model/types';
import { dictionaryApi } from '@/entities/dictionary/api/dictionaryApi';
import { FlashcardItem } from '@/widgets/flashcard-deck/ui/FlashcardDeck';
import { AudioItem } from '@/widgets/audio-challenge/ui/AudioChallenge';

export interface UseTrainerWordsOptions {
  initialLevel?: string;
  initialCategory?: string;
  onRefreshStats?: () => void;
}

export function useTrainerWords(options: UseTrainerWordsOptions = {}) {
  const [searchParams] = useSearchParams();
  const level = searchParams.get('level') || options.initialLevel || 'A1';
  const category = searchParams.get('category') || options.initialCategory || 'general';

  const [words, setWords] = useState<DictionaryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCramMode, setIsCramMode] = useState<boolean>(false);
  const [totalInDb, setTotalInDb] = useState<number>(0);
  const isReplenishingRef = useRef<boolean>(false);

  const handleNeedMoreWords = useCallback(async (count = 50): Promise<DictionaryItem[]> => {
    if (isReplenishingRef.current) return [];
    isReplenishingRef.current = true;
    try {
      const res = await dictionaryApi.generateWords(level, category, count);
      if (res.success && res.data?.length > 0) {
        setWords(prev => {
          const existingIds = new Set(prev.map(w => w.id));
          const fresh = res.data.filter(w => !existingIds.has(w.id));
          return [...prev, ...fresh];
        });
        message.success(res.message || `Добавлено ${res.data.length} новых слов!`);
        return res.data;
      }
      return [];
    } catch (err) {
      console.warn('Auto-replenishment note:', err);
      return [];
    } finally {
      isReplenishingRef.current = false;
    }
  }, [level, category]);

  const fetchWords = useCallback(async () => {
    setLoading(true);
    try {
      let res = await dictionaryApi.getDictionary({
        level,
        sectionId: category,
        mode: 'practice',
        limit: 1000,
      });

      // Infinite Learning Fallback:
      // If practice mode returned 0 words (user has completed all repetitions for today),
      // fetch words of this level for free review (cram mode).
      if (!res.data || res.data.length === 0) {
        res = await dictionaryApi.getDictionary({
          level,
          sectionId: category,
          limit: 1000,
        });
        setIsCramMode(true);
      } else {
        setIsCramMode(Boolean(res.pagination?.isCramMode));
      }

      const fetchedWords = res.data || [];
      setWords(fetchedWords);
      const dbCount = res.pagination?.totalInDb ?? res.pagination?.total ?? fetchedWords.length;
      setTotalInDb(dbCount);

      if (fetchedWords.length === 0) {
        // If there are zero words, await initial auto-generation so the user does not land on an empty screen
        const fresh = await handleNeedMoreWords(50);
        if (fresh && fresh.length > 0) {
          return fresh;
        }
      } else if (fetchedWords.length < 20) {
        handleNeedMoreWords(50);
      }
      return fetchedWords;
    } catch (err) {
      console.error('Failed to load trainer words:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [level, category, handleNeedMoreWords]);

  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  const handleGameComplete = useCallback(async (xpEarned: number) => {
    try {
      if (xpEarned > 0) {
        options.onRefreshStats?.();
      }
      fetchWords();
    } catch (err) {
      console.error('Failed to update stats after game:', err);
    }
  }, [options, fetchWords]);

  const cardItems = useMemo<FlashcardItem[]>(() => {
    const seen = new Set<string>();
    const unique: FlashcardItem[] = [];
    for (const w of words) {
      const key = (w.word || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push({
          id: w.id,
          frontMain: w.word,
          frontPhonetic: w.transcription,
          frontContext: w.example_sentence,
          backMain: w.translation,
          backDetail: w.definition,
          backGrammar: w.example_translation,
          level: w.level,
          category: w.section_id,
        });
      }
    }
    return unique.sort(() => 0.5 - Math.random());
  }, [words]);

  const audioItems = useMemo<AudioItem[]>(() => {
    const seen = new Set<string>();
    const unique: AudioItem[] = [];
    for (const w of words) {
      const s = (w.example_sentence || w.word || '').trim();
      if (s && !seen.has(s.toLowerCase())) {
        seen.add(s.toLowerCase());
        unique.push({
          id: w.id,
          sentence: s,
          translation: w.example_translation || w.translation,
          hint: w.definition,
          level: w.level,
        });
      }
    }
    return unique.sort(() => 0.5 - Math.random());
  }, [words]);

  return {
    words,
    cardItems,
    audioItems,
    loading,
    isCramMode,
    totalInDb,
    level,
    category,
    fetchWords,
    handleNeedMoreWords,
    handleGameComplete,
  };
}
