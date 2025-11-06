import { useState, useEffect, useCallback } from 'react';
import { ingredientApi, Ingredient } from '@/entities/ingredient';
import { debounce } from '@/shared/lib/utils';

export const useIngredients = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // 검색 실행 (디바운스)
  const executeSearch = useCallback(
    debounce(async (query: string, cursor?: number) => {
      if (!query.trim()) {
        setIngredients([]);
        setNextCursor(null);
        setHasMore(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await ingredientApi.search(query, 20, cursor);
        
        if (cursor) {
          // 페이지네이션 - 기존 결과에 추가
          setIngredients(prev => [...prev, ...result.items]);
        } else {
          // 새 검색 - 결과 교체
          setIngredients(result.items);
        }
        
        setNextCursor(result.next_cursor);
        setHasMore(result.has_more);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search ingredients');
        if (!cursor) {
          setIngredients([]);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  // 검색어 변경 시 자동 검색
  useEffect(() => {
    executeSearch(searchQuery);
  }, [searchQuery, executeSearch]);

  // 더 불러오기
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading && nextCursor) {
      executeSearch(searchQuery, nextCursor);
    }
  }, [hasMore, isLoading, nextCursor, searchQuery, executeSearch]);

  // 특정 성분 찾기 (현재 로드된 결과에서)
  const findIngredient = (query: string): Ingredient | undefined => {
    const key = query.trim();
    if (!key) return undefined;

    // 정확히 일치하는 한글명
    let hit = ingredients.find(i => i.korean_name === key);
    if (hit) return hit;

    // 포함하는 한글명
    hit = ingredients.find(i => i.korean_name.includes(key));
    if (hit) return hit;

    // 영문명 (대소문자 무시)
    hit = ingredients.find(i => (i.english_name || '').toLowerCase() === key.toLowerCase());
    return hit;
  };

  return {
    ingredients,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    hasMore,
    loadMore,
    findIngredient,
  };
};
