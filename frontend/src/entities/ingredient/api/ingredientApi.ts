import { API_BASE } from '@/lib/env';
import { Ingredient } from '../model/types';

export interface IngredientSearchResponse {
  items: Ingredient[];
  next_cursor: number | null;
  has_more: boolean;
}

export const ingredientApi = {
  /**
   * 성분 검색 (새 API - 커서 페이지네이션)
   */
  async search(
    query: string,
    limit: number = 20,
    cursor?: number
  ): Promise<IngredientSearchResponse> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    if (cursor) {
      params.append('cursor', String(cursor));
    }

    const response = await fetch(`${API_BASE}/ingredients/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to search ingredients');
    }
    return response.json();
  },

  /**
   * 전체 성분 목록 조회 - 하위 호환성을 위해 유지
   * 새 코드에서는 search() 사용 권장
   * @deprecated
   */
  async fetchAll(limit: number = 5000): Promise<Ingredient[]> {
    console.warn('ingredientApi.fetchAll is deprecated. Use search() instead.');
    const response = await fetch(`${API_BASE}/ingredients/list_all?limit=${limit}`);
    if (!response.ok) {
      throw new Error('Failed to fetch ingredients');
    }
    const raw = await response.json();
    return (raw || [])
      .map((r: any) => ({
        id: Number(r.id),
        korean_name: r.korean_name,
        english_name: r.english_name ?? null,
        description: r.description ?? null,
        caution_grade: r.caution_grade ?? r.caution ?? r.caution_g ?? null,
      }))
      .filter((x: Ingredient) => x.id && x.korean_name);
  },
};
