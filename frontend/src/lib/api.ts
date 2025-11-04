// frontend/src/lib/utils.ts
// ------------------------------------------------------------------
// 공용 타입
// ------------------------------------------------------------------
export type RecProduct = {
  pid: string;
  brand?: string;
  product_name?: string;
  category?: string;
  price_krw?: number;
  image_url?: string;
  rag_text?: string;
  score?: number;
  product_url?: string;
};

// ------------------------------------------------------------------
// LLM 채팅 스트리밍 (기존 유지)
//  - 프록시(/api/*) 경유: vite dev proxy 또는 nginx 프록시 기준
// ------------------------------------------------------------------
export async function chatStream(query: string, top_k = 6, signal?: AbortSignal) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k }),
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
// 추천 카드 조회 (기존 유지)
//  - 프록시(/api/*) 경유
// ------------------------------------------------------------------
export async function fetchRecommendations(query: string, top_k = 12) {
  const res = await fetch('/api/chat/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<{ products: RecProduct[] }>;
}

// ------------------------------------------------------------------
// OCR 업로드/검색 API (신규)
//  - 서버 직접 호출: VITE_API_BASE 필요
//  - .env 예) VITE_API_BASE=http://127.0.0.1:8000
// ------------------------------------------------------------------
const API_BASE =
  ((import.meta as any).env?.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000';

type OcrRender = { text: string; image_url?: string | null };
type OcrOk = { success: true; analysis: any; render: OcrRender };
type OcrFail = { success: false; error?: string | null; analysis?: any; render?: OcrRender };

export async function uploadOcrImage(
  file: File
): Promise<{ analysis: any; render: { text: string; image_url?: string } }> {
  const fd = new FormData();
  fd.append("image", file);  // ✅ 필드명 image 유지

  const res = await fetch(`${API_BASE}/api/ocr/analyze-image`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`OCR 업로드 실패: ${res.status} ${msg}`);
  }

  const json = await res.json();

  // ✅ 백엔드 형태를 프론트가 쓰는 공통 형태로 변환
  return {
    analysis: json?.raw?.data ?? null,
    render: {
      text: json?.markdown ?? "분석 결과가 없습니다.",
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
