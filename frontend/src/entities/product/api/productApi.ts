import { API_BASE } from '@/lib/env';
import { FavoriteProduct, ProductDetail } from '../model/types';

export const productApi = {
  /**
   * 즐겨찾기 제품 목록 조회
   */
  async fetchFavorites(userId: number): Promise<FavoriteProduct[]> {
    const response = await fetch(`${API_BASE}/favorite_products/${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch favorite products');
    }
    return response.json();
  },

  /**
   * 즐겨찾기 추가
   */
  async addFavorite(userId: number, productId: number): Promise<void> {
    const response = await fetch(
      `${API_BASE}/favorite_products/?user_id=${userId}&product_id=${productId}`,
      { method: 'POST' }
    );
    if (!response.ok) {
      throw new Error('Failed to add favorite');
    }
  },

  /**
   * 즐겨찾기 제거
   */
  async removeFavorite(userId: number, productId: number): Promise<void> {
    const response = await fetch(
      `${API_BASE}/favorite_products/?user_id=${userId}&product_id=${productId}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      throw new Error('Failed to remove favorite');
    }
  },

  /**
   * 제품 상세 정보 조회
   */
  async fetchDetail(productId: number): Promise<ProductDetail> {
    const response = await fetch(`${API_BASE}/product/detail/${productId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch product detail');
    }
    const data = await response.json();
    return {
      product_pid: data.product_pid,
      product_id: data.product_id,
      display_name: data.display_name || `${data.brand || ''} - ${data.product_name || ''}`,
      brand: data.brand,
      product_name: data.product_name,
      category: data.category || '카테고리 정보 없음',
      image_url: data.image_url || '',
      price_krw: data.price_krw,
      capacity: data.capacity || '용량 정보 없음',
      product_url: data.product_url || '',
      description: data.description || '제품 설명이 없습니다.',
      step: data.category || '단계 정보 없음',
      reason: data.category || '카테고리 정보 없음',
    };
  },
};
