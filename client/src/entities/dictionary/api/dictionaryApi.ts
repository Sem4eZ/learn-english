import { DictionaryItem, DictionaryFilterParams, DictionaryResponse } from '../model/types';
import { apiClient } from '@/shared/api/client';
import { FALLBACK_WORDS } from '@/shared/lib/fallbackData';

// Cache for offline / GitHub Pages mode
let localWordsCache: DictionaryItem[] | null = null;

function getOfflineWords(): DictionaryItem[] {
  if (localWordsCache) return localWordsCache;
  try {
    const saved = localStorage.getItem('fluentiq_offline_words');
    if (saved) {
      localWordsCache = JSON.parse(saved);
      return localWordsCache!;
    }
  } catch (_) {}
  localWordsCache = [...FALLBACK_WORDS];
  return localWordsCache;
}

function saveOfflineWords(words: DictionaryItem[]) {
  localWordsCache = words;
  try {
    localStorage.setItem('fluentiq_offline_words', JSON.stringify(words));
  } catch (_) {}
}

export const dictionaryApi = {
  async getDictionary(params: DictionaryFilterParams = {}): Promise<DictionaryResponse> {
    const queryParams: Record<string, string | number | boolean | undefined> = {};
    if (params.search) queryParams.search = params.search;
    if (params.sectionId && params.sectionId !== 'all') queryParams.sectionId = params.sectionId;
    if (params.level && params.level !== 'all') queryParams.level = params.level;
    if (params.favoritesOnly) queryParams.favoritesOnly = true;
    if (params.mode) queryParams.mode = params.mode;
    if (params.page) queryParams.page = params.page;
    if (params.limit) queryParams.limit = params.limit;

    if (!apiClient.isOfflineMode()) {
      try {
        const res = await apiClient.get<DictionaryResponse>('/dictionary', queryParams);
        if (res && res.data && res.data.length > 0) {
          saveOfflineWords(res.data);
          return res;
        }
      } catch (err) {
        console.warn('Backend unavailable, using resilient offline dictionary:', err);
      }
    }

    // Resilient offline fallback for GitHub Pages
    let filtered = getOfflineWords();
    if (params.sectionId && params.sectionId !== 'all') {
      filtered = filtered.filter(w => w.section_id === params.sectionId);
    }
    if (params.level && params.level !== 'all') {
      filtered = filtered.filter(w => w.level === params.level);
    }
    if (params.favoritesOnly) {
      filtered = filtered.filter(w => w.is_favorite);
    }
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filtered = filtered.filter(w => 
        w.word.toLowerCase().includes(q) || 
        w.translation.toLowerCase().includes(q) ||
        (w.definition && w.definition.toLowerCase().includes(q))
      );
    }

    const page = params.page || 1;
    const limit = params.limit || 50;
    const startIndex = (page - 1) * limit;
    const pageItems = filtered.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data: pageItems,
      pagination: {
        page,
        limit,
        total: filtered.length,
        pages: Math.ceil(filtered.length / limit) || 1,
        totalInDb: filtered.length,
        totalOverall: filtered.length
      }
    };
  },

  async toggleFavorite(id: number): Promise<DictionaryItem> {
    if (!apiClient.isOfflineMode()) {
      try {
        const res = await apiClient.post<{ success: boolean; data: DictionaryItem }>(`/dictionary/${id}/favorite`);
        return res.data;
      } catch (err) {
        console.warn('Backend unavailable, toggling favorite locally:', err);
      }
    }
    const words = getOfflineWords();
    const item = words.find(w => w.id === id);
    if (item) {
      item.is_favorite = item.is_favorite ? 0 : 1;
      saveOfflineWords(words);
      return item;
    }
    throw new Error('Слово не найдено');
  },

  async generateWords(level = 'A1', sectionId = 'general', count = 35): Promise<{ success: boolean; message: string; data: DictionaryItem[]; totalCount: number }> {
    if (!apiClient.isOfflineMode()) {
      try {
        return await apiClient.post('/dictionary/generate', { level, sectionId, count });
      } catch (err) {
        console.warn('Backend generator unavailable, returning cached words:', err);
      }
    }
    const words = getOfflineWords();
    return {
      success: true,
      message: 'Используются встроенные слова (офлайн-режим)',
      data: words,
      totalCount: words.length
    };
  },

  async lookupWord(word: string): Promise<{ success: boolean; data: DictionaryItem; isNew: boolean; message: string; error?: string }> {
    if (!apiClient.isOfflineMode()) {
      try {
        return await apiClient.post('/dictionary/lookup', { word });
      } catch (err: any) {
        console.warn('Backend lookup unavailable, searching local dictionary:', err);
      }
    }
    const words = getOfflineWords();
    const existing = words.find(w => w.word.toLowerCase() === word.toLowerCase().trim());
    if (existing) {
      return {
        success: true,
        data: existing,
        isNew: false,
        message: `Слово «${existing.word}» найдено в словаре!`
      };
    }
    return {
      success: false,
      data: null as any,
      isNew: false,
      message: 'Для поиска новых редких слов через Gemini подключите бэкенд-сервер',
      error: 'Бэкенд недоступен в автономном режиме'
    };
  }
};
