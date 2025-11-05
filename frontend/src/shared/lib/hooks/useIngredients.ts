// npm i use-debounce
import { useState, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { ingredientApi, Ingredient } from '@/entities/ingredient';

interface SearchResponse {
  items: Ingredient[];
  next_cursor: number | null;
  has_more: boolean;
}

export const useIngredients = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const cancelOngoing = (): void => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  // 디바운스된 검색 (setTimeout 직접 사용 X)
  const search = useDebouncedCallback(async (query: string): Promise<void> => {
    const key = query.trim();
    setSearchQuery(query);

    if (!key) {
      cancelOngoing();
      setIngredients([]);
      setCursor(null);
      setHasMore(false);
      setError(null);
      return;
    }

    cancelOngoing();
    const ac = new AbortController();
    abortRef.current = ac;

    setIsLoading(true);
    setError(null);

    try {
      const { items, next_cursor, has_more }: SearchResponse =
        await ingredientApi.searchIngredients(key, 20, undefined, ac.signal);
      if (!ac.signal.aborted) {
        setIngredients(items);
        setCursor(next_cursor);
        setHasMore(has_more);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '검색 실패');
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      if (!ac.signal.aborted) setIsLoading(false);
    }
  }, 250);

  const loadMore = async (): Promise<void> => {
    if (!hasMore || isLoading || !searchQuery.trim() || cursor == null) return;

    cancelOngoing();
    const ac = new AbortController();
    abortRef.current = ac;
    setIsLoading(true);

    try {
      const { items, next_cursor, has_more }: SearchResponse =
        await ingredientApi.searchIngredients(searchQuery.trim(), 20, cursor, ac.signal);
      if (!ac.signal.aborted) {
        setIngredients(prev => [...prev, ...items]);
        setCursor(next_cursor);
        setHasMore(has_more);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '추가 로드 실패');
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      if (!ac.signal.aborted) setIsLoading(false);
    }
  };

  return {
    ingredients,
    isLoading,
    error,
    searchQuery,
    setSearchQuery, // 필요하면 수동 변경
    search, // onChange에서 search(e.target.value)
    loadMore,
    hasMore,
  };
};
