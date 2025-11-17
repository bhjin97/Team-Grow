import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_BASE } from './env';

// 1. cn (기존)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 2. ensureLightMode (기존)
export function ensureLightMode() {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', false);
  }
}

// 3. removeDarkClasses (기존)
export function removeDarkClasses(className: string): string {
  return className
    .split(' ')
    .filter(cls => !cls.startsWith('dark:'))
    .join(' ');
}

// 4. fetchRoutine (기존)
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

// 5. fetchSimulation (기존)
export async function fetchSimulation(product_name: string, skin_type: string, userId?: number) {
  if (!API_BASE) {
    console.error('API_BASE is not defined. Check frontend/lib/env.ts');
    throw new Error('API_BASE is not defined');
  }

  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      product_name: product_name,
      skin_type: skin_type,
      user_id:
        userId !== undefined && userId !== null && !Number.isNaN(Number(userId))
          ? Number(userId)
          : null, // 백엔드가 None으로 받지 않게, 프론트에서 effectiveUserId를 보정했다면 null이 안 오게 만드는 게 더 좋음
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || '제품 분석에 실패했습니다.');
  }

  return res.json();
}

// 6. fetchCategories (기존)
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

// 7. fetchProductsByCategory (기존)
export async function fetchProductsByCategory(
  category: string
): Promise<{ product_name: string }[]> {
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
export async function fetchTopProductsByCategory(
  category: string,
  skin_type: string,
  userId?: number,
  limit = 8
) {
  const params = new URLSearchParams();
  params.set('category', category ?? '');
  params.set('skin_type', skin_type ?? '');
  if (userId != null) params.set('user_id', String(Number(userId)));
  params.set('limit', String(limit));

  const url = `${API_BASE}/api/top-products?${params.toString()}`;
  console.log('[REQ] GET', url);
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`top-products 실패 ${res.status} ${txt}`);
  }
  const data = await res.json();
  // 항상 배열 보장
  return Array.isArray(data?.items) ? data.items : [];
}

// 8. fetchPerfumeRecommendations (기존)
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
      accept: 'application/json',
    },
    body: JSON.stringify(requestData),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || '향수 추천을 받아오는 데 실패했습니다.');
  }

  return res.json();
}

// --- [★★★ 2-A: 새로 추가된 프로필 함수 2개 ★★★] ---

// API의 UserProfileUpdate Pydantic 모델과 일치하는 타입
interface UserProfileUpdateData {
  name: string;
  email: string;
  nickname: string | null;
  birthYear: number | null;
  gender: string | null;
  skinTypeCode: string | null;
}

/**
 * 백엔드 /api/user_card/{user_id} (GET)를 호출하여 프로필 정보를 가져옵니다.
 */
export async function fetchUserProfile(userId: number): Promise<any> {
  if (!API_BASE) {
    console.error('API_BASE is not defined.');
    throw new Error('API_BASE is not defined');
  }

  const res = await fetch(`${API_BASE}/api/user_card/${userId}`);

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || '프로필 정보를 불러오는 데 실패했습니다.');
  }

  return res.json();
}

/**
 * 백엔드 /api/user_card/{user_id} (PUT)를 호출하여 프로필 정보를 업데이트합니다.
 */
export async function updateUserProfile(userId: number, data: UserProfileUpdateData): Promise<any> {
  if (!API_BASE) {
    console.error('API_BASE is not defined.');
    throw new Error('API_BASE is not defined');
  }

  const res = await fetch(`${API_BASE}/api/user_card/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || '프로필 업데이트에 실패했습니다.');
  }

  return res.json();
}
// ============================================
// [신규] OCR 이미지 분석 함수
// ============================================

/**
 * 이미지 OCR을 통한 제품 분석
 *
 * @param file 업로드한 이미지 파일
 * @param skin_type 피부 타입
 * @returns 분석 결과 (fetchSimulation과 동일한 형식)
 */
export async function fetchOcrAnalysis(file: File, skin_type: string, userId?: number) {
  if (!API_BASE) {
    console.error('API_BASE is not defined. Check frontend/lib/env.ts');
    throw new Error('API_BASE is not defined');
  }

  // FormData 생성
  const formData = new FormData();
  formData.append('file', file);
  formData.append('skin_type', skin_type);
  // userId가 유효한 숫자일 때만 append (빈 문자열 전송 방지)
  if (userId !== undefined && userId !== null && !Number.isNaN(Number(userId))) {
    formData.append('user_id', String(Number(userId)));
  }
  console.log('[REQ] /api/analyze-ocr form user_id =', userId);
  const res = await fetch(`${API_BASE}/api/analyze-ocr`, {
    method: 'POST',
    body: formData, // Content-Type은 자동 설정됨 (multipart/form-data)
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.detail || 'OCR 분석에 실패했습니다.');
  }

  return res.json();
}

// 성분분석 즐겨찾기제품명 버튼
export async function fetchFavoriteProducts(userId: number) {
  const res = await fetch(`${API_BASE}/api/favorite-products?user_id=${userId}`, {
    method: 'GET',
  });

  if (!res.ok) {
    throw new Error('즐겨찾기 제품을 불러오지 못했어요.');
  }
  return res.json();
}
