export interface FavoriteProduct {
  product_id: number;
  product_name: string;
  brand: string;
  category: string;
  image_url: string;
  price_krw?: number;
  review_count?: number;
  capacity?: string;
  product_url?: string;
  rag_text?: string;
}

export interface RecentRecommendation {
  product_pid: string;
  display_name: string;
  image_url: string;
  reason: string;
  category: string;
  price_krw?: number;
  review_count?: number;
  created_at?: string;
  type?: string;
  source?: 'routine' | 'chat' | string;
}

export interface ProductDetail {
  product_pid: string;
  product_id?: number;
  display_name: string;
  brand?: string;
  product_name?: string;
  category: string;
  image_url: string;
  price_krw?: number;
  capacity?: string;
  product_url?: string;
  description?: string;
  reason?: string;
  step?: string;
}
