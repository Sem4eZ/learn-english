import { DictionaryItem, DictionaryFilterParams, DictionaryResponse } from '../model/types';

export const dictionaryApi = {
  async getDictionary(params: DictionaryFilterParams = {}): Promise<DictionaryResponse> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.sectionId && params.sectionId !== 'all') query.append('sectionId', params.sectionId);
    if (params.level && params.level !== 'all') query.append('level', params.level);
    if (params.favoritesOnly) query.append('favoritesOnly', 'true');
    if (params.mode) query.append('mode', params.mode);
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const res = await fetch(`/api/dictionary?${query.toString()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async toggleFavorite(id: number): Promise<DictionaryItem> {
    const res = await fetch(`/api/dictionary/${id}/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    return data.data;
  },

  async generateWords(level = 'A1', sectionId = 'general', count = 35): Promise<{ success: boolean; message: string; data: DictionaryItem[]; totalCount: number }> {
    const res = await fetch('/api/dictionary/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, sectionId, count })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  },

  async lookupWord(word: string): Promise<{ success: boolean; data: DictionaryItem; isNew: boolean; message: string; error?: string }> {
    const res = await fetch('/api/dictionary/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word })
    });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  }
};
