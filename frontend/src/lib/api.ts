// frontend/src/lib/api.ts
// ------------------------------------------------------------------
// 공용 타입
// ------------------------------------------------------------------
export type RecProduct = {
  pid: number;
  brand?: string;
  product_name?: string;
  category?: string;
  price_krw?: number;
  image_url?: string;
  rag_text?: string;
  score?: number;
  product_url?: string;
  ingredients?: string[];
  ingredients_detail?: { name: string; caution_grade: '위험' | '주의' | '안전' | null }[];
};

export interface IngredientInfo {
  name: string;
  description: string | null;
  caution_grade: CautionGrade;
}
export type CautionGrade = '위험' | '주의' | '안전' | null;

// ------------------------------------------------------------------
// API BASE (절대경로; 끝 슬래시 제거)
//  - .env 예) VITE_API_BASE=http://<EC2-PUBLIC-IP>:8000
// ------------------------------------------------------------------
const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000';

// ------------------------------------------------------------------
// LLM 채팅 스트리밍
//  - 절대경로(백엔드 8000) + /api/chat 로 통일
// ------------------------------------------------------------------
export async function chatStream(query: string, top_k = 6, signal?: AbortSignal) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k }),
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const cacheKey = res.headers.get('x-cache-key') || undefined;
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');

  return {
    cacheKey,
    async *iter() {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        yield decoder.decode(value);
      }
    },
  };
}

// ------------------------------------------------------------------
// 추천 카드 조회
//  - 절대경로(백엔드 8000) + /api/chat/recommend 로 통일
// ------------------------------------------------------------------
export async function fetchRecommendations(query: string, top_k = 12, cache_key?: string) {
  const res = await fetch(`${API_BASE}/api/chat/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k, cache_key }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ products: RecProduct[] }>;
}

// ------------------------------------------------------------------
// OCR 업로드/검색 API (기존 유지)
//  - 서버 직접 호출: VITE_API_BASE 필요
// ------------------------------------------------------------------
type OcrRender = { text: string; image_url?: string | null };
type OcrOk = { success: true; analysis: any; render: OcrRender };
type OcrFail = { success: false; error?: string | null; analysis?: any; render?: OcrRender };

export async function uploadOcrImage(
  file: File
): Promise<{ analysis: any; render: { text: string; image_url?: string } }> {
  const fd = new FormData();
  fd.append('image', file); // ✅ 필드명 image 유지

  const res = await fetch(`${API_BASE}/api/ocr/analyze-image`, {
    method: 'POST',
    body: fd,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`OCR 업로드 실패: ${res.status} ${msg}`);
  }

  const json = await res.json();

  // ✅ 백엔드 형태를 프론트가 쓰는 공통 형태로 변환
  return {
    analysis: json?.raw?.data ?? null,
    render: {
      text: json?.markdown ?? '분석 결과가 없습니다.',
      image_url: json?.image_url ?? undefined,
    },
  };
}

export async function searchOcrByName(
  productName: string
): Promise<{ analysis: any; render: OcrRender }> {
  const res = await fetch(`${API_BASE}/api/ocr/search-name`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_name: productName }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`제품명 검색 실패: ${res.status} ${msg}`);
  }

  const json = (await res.json()) as OcrOk | OcrFail;
  if (!json.success) {
    return {
      analysis: json.analysis ?? null,
      render: json.render ?? { text: '❌ 검색 실패', image_url: null },
    };
  }
  return { analysis: json.analysis, render: json.render };
}

/** 성분 상세 정보 조회
 *  - 절대경로(백엔드 8000) + /api/chat/ingredient/:name 로 통일
 */
export async function fetchIngredientDetail(name: string): Promise<IngredientInfo> {
  const res = await fetch(`${API_BASE}/api/chat/ingredient/${encodeURIComponent(name)}`, {
    method: 'GET',
  });
  if (!res.ok) throw new Error('성분 정보를 불러오지 못했습니다.');
  return res.json();
}

// ------------------------------------------------------------------
// 사용자 성분 보관함 API (추가)
//  - 라우터 스펙에 맞춰 절대경로 + 스키마 일치
// ------------------------------------------------------------------

/** 목록: GET /api/user-ingredients?userId=... */
export async function getUserIngredients(userId: number) {
  const url = `${API_BASE}/api/user-ingredients?userId=${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`getUserIngredients HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json() as Promise<
    Array<{
      userId: number;
      userName: string;
      koreanName: string;
      ingType: 'preferred' | 'caution';
      createAt?: string | null;
    }>
  >;
}

/** 추가: POST /api/user-ingredients  (body: { userId, koreanName, ingType, userName? }) */
export async function addUserIngredient(params: {
  userId: number;
  koreanName: string;
  ingType: 'preferred' | 'caution';
  userName?: string;
}) {
  const res = await fetch(`${API_BASE}/api/user-ingredients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`addUserIngredient HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

/** 삭제: DELETE /api/user-ingredients/{userId}/{key}?ingType=preferred|caution */
export async function deleteUserIngredient(
  userId: number,
  key: string | number,
  ingType?: 'preferred' | 'caution'
) {
  const base = `${API_BASE}/api/user-ingredients/${encodeURIComponent(
    userId
  )}/${encodeURIComponent(String(key))}`;
  const url = ingType ? `${base}?ingType=${encodeURIComponent(ingType)}` : base;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`deleteUserIngredient HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}
