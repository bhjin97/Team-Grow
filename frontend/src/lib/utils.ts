import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_BASE } from './env';

// 1. cn (중복 제거)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 2. ensureLightMode (중복 제거)
export function ensureLightMode() {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', false);
  }
}

// 3. removeDarkClasses (중복 제거)
export function removeDarkClasses(className: string): string {
  return className
    .split(' ')
    .filter(cls => !cls.startsWith('dark:'))
    .join(' ');
}

// 4. fetchRoutine (팀원 코드 - 중복 제거)
export async function fetchRoutine(
  baumannType: string,
  season: string,
  timeOfDay: string,
  keywords: string[]
) {
  const query = new URLSearchParams({
    skin_type: baumannType,
    season,
    time: timeOfDay,
    keywords: keywords.join(','),
  });

  const res = await fetch(`${API_BASE}/routine/recommend?${query.toString()}`);
  if (!res.ok) {
    throw new Error('루틴 API 호출 실패');
  }
  return res.json();
}

// 5. fetchSimulation (가상 피부 시뮬레이션 - 중복 제거)
export async function fetchSimulation(product_name: string, skin_type: string) {
  if (!API_BASE) {
    console.error('API_BASE is not defined. Check frontend/lib/env.ts');
    throw new Error('API_BASE is not defined');
  }
  
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify({
      product_name: product_name,
      skin_type: skin_type,
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || '제품 분석에 실패했습니다.');
  }

  return res.json();
}

// 6. fetchCategories (가상 피부 시뮬레이션 - 중복 제거)
export async function fetchCategories(): Promise<string[]> {
  if (!API_BASE) {
    console.error('API_BASE is not defined. Check frontend/lib/env.ts');
    throw new Error('API_BASE is not defined');
  }

  const res = await fetch(`${API_BASE}/api/categories`);
  
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || '카테고리 목록을 불러오는 데 실패했습니다.');
  }

  return res.json();
}

// 7. fetchProductsByCategory (가상 피부 시뮬레이션 - 중복 제거)
export async function fetchProductsByCategory(category: string): Promise<{ product_name: string }[]> {
  if (!API_BASE) {
    console.error('API_BASE is not defined. Check frontend/lib/env.ts');
    throw new Error('API_BASE is not defined');
  }

  const query = new URLSearchParams({ category: category });
  const res = await fetch(`${API_BASE}/api/products-by-category?${query.toString()}`);

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || '제품 목록을 불러오는 데 실패했습니다.');
  }

  return res.json();
}

// 8. fetchPerfumeRecommendations (향수 추천 - 신규 추가)
interface PerfumeRequestData {
  city: string;
  location: string;
  age: string;
  mood: string;
  price_range: string;
}

export async function fetchPerfumeRecommendations(requestData: PerfumeRequestData): Promise<any> {
  if (!API_BASE) {
    console.error('API_BASE is not defined. Check frontend/lib/env.ts');
    throw new Error('API_BASE is not defined');
  }
  
  const res = await fetch(`${API_BASE}/api/perfume/recommend_v2`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: JSON.stringify(requestData),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || '향수 추천을 받아오는 데 실패했습니다.');
  }

  return res.json();
}