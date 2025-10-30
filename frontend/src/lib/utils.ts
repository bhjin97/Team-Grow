import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_BASE } from './env';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Ensures light mode is always used by removing the dark class from the document element.
 * This can be called from any component that needs to ensure light mode.
 */
export function ensureLightMode() {
  if (typeof document !== 'undefined') {
    // Always set dark mode to false
    document.documentElement.classList.toggle('dark', false);
  }
}

/**
 * Removes any dark mode classes from a className string
 * @param className The class string to process
 * @returns The class string with dark mode classes removed
 */
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

// --- [★★★ 4단계: 새로 추가된 함수 ★★★] ---

/**
 * 백엔드 /api/analyze 엔드포인트를 호출하여 제품 분석 결과를 가져옵니다.
 * @param product_name - 분석할 제품의 전체 이름
 * @param skin_type - 사용자의 바우만 피부 타입 (예: "OSNT")
 * @returns {Promise<any>} - 백엔드에서 반환된 전체 분석 JSON 객체
 */
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
    // 404, 500 등 오류가 발생하면 서버가 보낸 오류 메시지를 throw
    const errorData = await res.json();
    throw new Error(errorData.detail || '제품 분석에 실패했습니다.');
  }

  return res.json();
}