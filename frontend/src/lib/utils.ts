import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_BASE } from './env';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function ensureLightMode() {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', false);
  }
}

export function removeDarkClasses(className: string): string {
  return className
    .split(' ')
    .filter(cls => !cls.startsWith('dark:'))
    .join(' ');
}

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

// --- [★★★ 2단계-A: 새로 추가된 함수 2개 ★★★] ---

/**
 * 백엔드 /api/categories 엔드포인트를 호출하여 카테고리 목록을 가져옵니다.
 * @returns {Promise<string[]>} - 카테고리 이름 문자열 배열
 */
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

  return res.json(); // 예: ["스킨/토너", "크림", "선크림"]
}

/**
 * 백엔드 /api/products-by-category 엔드포인트를 호출하여 제품 목록을 가져옵니다.
 * @param category - 조회할 카테고리 이름
 * @returns {Promise<{product_name: string}[]>} - 제품 객체 배열
 */
export async function fetchProductsByCategory(category: string): Promise<{ product_name: string }[]> {
  if (!API_BASE) {
    console.error('API_BASE is not defined. Check frontend/lib/env.ts');
    throw new Error('API_BASE is not defined');
  }

  // URLSearchParams를 사용해 쿼리 파라미터를 안전하게 인코딩합니다.
  const query = new URLSearchParams({ category: category });
  const res = await fetch(`${API_BASE}/api/products-by-category?${query.toString()}`);

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || '제품 목록을 불러오는 데 실패했습니다.');
  }

  return res.json(); // 예: [{"product_name": "A토너"}, {"product_name": "B토너"}]
}