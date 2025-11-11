import { useState, useEffect, useCallback } from 'react';
import { productApi, FavoriteProduct, RecentRecommendation } from '@/entities/product';

export const useFavorites = (userId: number | null) => {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      return;
    }

    const loadFavorites = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await productApi.fetchFavorites(userId);
        setFavorites(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load favorites');
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, [userId]);

  const isFavorite = useCallback(
    (productId: number) => {
      return favorites.some(f => f.product_id === productId);
    },
    [favorites]
  );

  const addFavorite = async (
    productId: number,
    productData?: Partial<FavoriteProduct>
  ): Promise<void> => {
    if (!userId) throw new Error('User not logged in');

    await productApi.addFavorite(userId, productId);

    // 목록에 추가
    const newFav: FavoriteProduct = {
      product_id: productId,
      product_name: productData?.product_name ?? '이름 없음',
      brand: productData?.brand ?? '',
      category: productData?.category ?? '',
      image_url: productData?.image_url ?? '',
      price_krw: productData?.price_krw,
      review_count: productData?.review_count,
    };
    setFavorites(prev => [newFav, ...prev]);
  };

  const removeFavorite = async (productId: number): Promise<void> => {
    if (!userId) throw new Error('User not logged in');

    await productApi.removeFavorite(userId, productId);
    setFavorites(prev => prev.filter(f => f.product_id !== productId));
  };

  const toggleFavorite = async (
    productId: number,
    productData?: Partial<FavoriteProduct>
  ): Promise<void> => {
    if (isFavorite(productId)) {
      await removeFavorite(productId);
    } else {
      await addFavorite(productId, productData);
    }
    // ✅ 서버 기준 최신 즐겨찾기 다시 불러오기
    try {
      const updated = await productApi.fetchFavorites(userId!);
      setFavorites(updated);
    } catch (err) {
      console.log("Failed to refresh favorites:", err);
    }
  };

  return {
    favorites,
    isLoading,
    error,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  };
};

export const useRecentRecommendations = () => {
  const [recommendations, setRecommendations] = useState<RecentRecommendation[]>([]);

  useEffect(() => {
    const uid = localStorage.getItem('user_id');
    if (!uid) return;

    const key = `recent_recommendations_${uid}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored);

      // ✅ 이미 flat 구조이므로 그대로 정렬만 하면 됨
      const sorted = parsed.sort(
        (a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setRecommendations(sorted);
    } catch (err) {
      console.error('Failed to load recent recommendations:', err);
    }
  }, []);

  return { recommendations };
};

