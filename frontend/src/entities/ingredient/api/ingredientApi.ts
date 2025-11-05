import { API_BASE } from '@/lib/env';
import { Ingredient } from '../model/types';

type BackendItem = {
  id: number | string;
  korean_name: string;
  english_name?: string | null;
  description?: string | null;
  caution_grade?: string | null;
  caution?: string | null; // 과거 키 대응
  caution_g?: string | null; // 과거 키 대응
};

interface SearchResponse {
  items: BackendItem[];
  next_cursor: number | null;
  has_more: boolean;
}

export const ingredientApi = {
  async searchIngredients(
    q: string,
    limit: number = 20,
    cursor?: number,
    signal?: AbortSignal
  ): Promise<{ items: Ingredient[]; next_cursor: number | null; has_more: boolean }> {
    const params = new URLSearchParams({ q, limit: String(limit) });
    if (cursor != null) params.set('cursor', String(cursor));

    const res = await fetch(`${API_BASE}/ingredients/search?${params.toString()}`, {
      signal,
    });
    if (!res.ok) throw new Error('Failed to search ingredients');

    const json: SearchResponse = await res.json();

    const items: Ingredient[] = (json.items ?? []).map(
      (r): Ingredient => ({
        id: Number(r.id),
        korean_name: r.korean_name,
        english_name: r.english_name ?? null,
        description: r.description ?? null,
        caution_grade: r.caution_grade ?? r.caution ?? r.caution_g ?? null,
      })
    );

    return {
      items,
      next_cursor: json.next_cursor ?? null,
      has_more: !!json.has_more,
    };
  },
};
