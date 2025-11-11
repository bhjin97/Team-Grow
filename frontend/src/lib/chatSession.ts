// src/lib/chatSession.ts
import type { RecProduct } from '@/lib/api';

/** 브라우저 세션 스토리지 키 & 보존 개수 */
export const SS_KEY = 'aller_chat_session_v1';
export const MAX_KEEP = 30;

/** UI Message와 호환되는 최소 형태 (세션 저장용) */
export type PersistMsg = {
  id: number;
  type: 'user' | 'ai';
  content: string;
  ts: number; // Date 직렬화
  products?: RecProduct[]; // 추천카드(그대로 저장/복원)
  // 필요 시 여기에 image/analysis/ocrImageUrl도 추가 가능
};

/** UI 컴포넌트에서 쓰는 Message 최소 형태 (복원 시 사용) */
export type MessageLike = {
  id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  products?: RecProduct[];
};

/** 오래된 메시지부터 잘라주는 헬퍼 */
export function tailKeep<T>(arr: T[], keep: number) {
  return keep > 0 ? arr.slice(-keep) : [];
}

/** PersistMsg[] -> MessageLike[] 로 변환 */
export function fromPersist(arr: PersistMsg[]): MessageLike[] {
  return arr.map(m => ({
    id: m.id,
    type: m.type,
    content: m.content,
    timestamp: new Date(m.ts),
    products: m.products,
  }));
}

/** MessageLike[] -> PersistMsg[] 로 변환 */
export function toPersist(arr: MessageLike[]): PersistMsg[] {
  return arr.map(m => ({
    id: m.id,
    type: m.type,
    content: m.content,
    ts: m.timestamp.getTime(),
    products: m.products,
  }));
}

/** 세션에서 읽기(없으면 빈 배열) — 구버전 포맷 호환 */
export function loadSession(key: string = SS_KEY): MessageLike[] {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list: PersistMsg[] = Array.isArray(parsed) ? parsed : (parsed?.messages ?? []);
    return fromPersist(tailKeep(list, MAX_KEEP));
  } catch {
    return [];
  }
}

/** 용량 초과 시 앞 절반 제거해서 다시 저장하는 안전 저장 */
function safeSetSession(key: string, value: { messages: PersistMsg[] }) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 용량 초과 등 -> 앞 절반 잘라서 재시도
    const msgs = value.messages;
    const trimmed = msgs.slice(Math.floor(msgs.length / 2));
    try {
      sessionStorage.setItem(key, JSON.stringify({ messages: trimmed }));
      // console.warn 생략: 콘솔 노이즈 줄이기
    } catch {
      // 최후 실패: 아무 것도 하지 않음 (UX 보호)
    }
  }
}

/** 디바운스된 저장기 생성: 컴포넌트에서 재사용 */
export function createSessionSaver(key: string = SS_KEY, delayMs = 200) {
  let timer: number | null = null;

  return function schedule(messages: PersistMsg[]) {
    try {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        safeSetSession(key, { messages });
        timer = null;
      }, delayMs);
    } catch {
      // no-op
    }
  };
}

/** 즉시 저장 (디바운스 없이 곧바로) */
export function saveSessionNow(messages: PersistMsg[], key: string = SS_KEY) {
  safeSetSession(key, { messages });
}

/** 세션 비우기 (필요 시 사용) */
export function clearSession(key: string = SS_KEY) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
