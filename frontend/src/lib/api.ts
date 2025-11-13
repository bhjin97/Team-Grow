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
// 추천 카드 + intent + cache_key 조회
//  - 절대경로(백엔드 8000) + /api/chat/recommend
//  - 검색 + intent 판별 + 카드 + cache_key 까지 한 번에
// ------------------------------------------------------------------
export type RecommendResponse = {
  intent: 'GENERAL' | 'PRODUCT_FIND';
  message: string | null;
  cache_key: string | null;
  products: RecProduct[];
};

export async function fetchRecommendations(
  query: string,
  top_k = 12,
  cache_key?: string
): Promise<RecommendResponse> {
  const res = await fetch(`${API_BASE}/api/chat/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k, cache_key }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<RecommendResponse>;
}

// ------------------------------------------------------------------
// LLM 요약 스트리밍 (Finalize 전용)
//  - 절대경로(백엔드 8000) + /api/chat/finalize
//  - recommend 에서 받은 cache_key 를 꼭 함께 전달해야 함
// ------------------------------------------------------------------
export async function chatStream(query: string, cacheKey: string, signal?: AbortSignal) {
  if (!cacheKey) {
    throw new Error(
      'chatStream 호출 시 cacheKey가 필요합니다. (먼저 fetchRecommendations를 호출하세요)'
    );
  }

  const res = await fetch(`${API_BASE}/api/chat/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, cache_key: cacheKey }),
    signal,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');

  return {
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
  // ✅ 백엔드 스펙: POST /api/ocr/by-name + FormData(product_name)
  const fd = new FormData();
  fd.append('product_name', productName);

  const res = await fetch(`${API_BASE}/api/ocr/by-name`, {
    method: 'POST',
    body: fd,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`제품명 검색 실패: ${res.status} ${msg}`);
  }

  // ✅ 백엔드 응답(success, markdown, image_url, raw)을 공통 형태로 변환
  const json = await res.json();
  return {
    analysis: json?.raw?.data ?? null,
    render: {
      text: json?.markdown ?? '분석 결과가 없습니다.',
      image_url: json?.image_url ?? null,
    },
  };
}

/** 성분 상세 정보 조회
 *  - 절대경로(백엔드 8000) + /api/chat/ingredient/:name
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
