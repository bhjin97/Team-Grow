// src/lib/trends/utils.ts

import { ANCHOR_WEEKDAY, WEEKDAY_EN, WEEKDAY_KR } from '@/settings/trends';

/** 'YYYY-MM-DD' → Date */
export function parseDate(dateStr: string): Date {
  // 로컬 타임존 영향 줄이려면 'YYYY-MM-DDT00:00:00Z' 변환도 고려 가능
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 'YYYY-MM-DD' → 요일(영문 약어) */
export function getWeekdayEN(dateStr: string): string {
  const day = parseDate(dateStr).getDay(); // 0(Sun)~6(Sat)
  return WEEKDAY_EN[day];
}

/** 'YYYY-MM-DD' → 요일(한글 약어) */
export function getWeekdayKR(dateStr: string): string {
  const day = parseDate(dateStr).getDay();
  return WEEKDAY_KR[day];
}

/** 기준 주인지 여부 (기본: 목요일) */
export function isAnchorWeek(dateStr: string, anchor: number = ANCHOR_WEEKDAY): boolean {
  return parseDate(dateStr).getDay() === anchor;
}

/**
 * 누적값 비감소 보정:
 * - 크롤링/적재 시 소수 건의 역주행(감소)이 잡힐 수 있어, 시계열을 단조 비증가/비감소로 보정할 때 사용
 */
export function clampNonDecreasing(prev: number | null, cur: number): number {
  if (prev === null) return Math.max(0, cur);
  return Math.max(prev, cur);
}

/**
 * 상대지수 계산(안전망):
 * - 백엔드가 `index`를 내려주지 않을 경우를 대비한 계산기
 * - 첫 주를 100으로 두고 상대값 산출
 */
export function ensureIndex(firstSum: number, currentSum: number): number {
  const base = Math.max(1, firstSum);
  return (currentSum / base) * 100;
}

/**
 * 카테고리 Δ 도넛 데이터 생성기:
 * - 현재 주/직전 주의 카테고리별 sum을 받아 Δ(음수 0 클램프)를 도넛용 배열로 변환
 */
export function buildDonutDelta(
  currentRow: Record<string, any> | null | undefined,
  prevRow: Record<string, any> | null | undefined,
  categories: string[],
): Array<{ label: string; value: number }> {
  if (!currentRow) return [];
  return categories.map((c) => {
    const cur = Number(currentRow[c]?.sum ?? 0);
    const prev = Number(prevRow?.[c]?.sum ?? 0);
    const delta = Math.max(0, cur - prev);
    return { label: c, value: delta };
  });
}

/**
 * 합계/지수 변화량 산출(요약 캡션용):
 * - 최근 N주 구간에서 카테고리별 (마지막-첫) sum/index 변화
 */
export function summarizeWindowChange(
  rows: Array<Record<string, any>>,
  categories: string[],
): Array<{ cat: string; deltaSum: number; deltaIdx: number }> {
  if (!rows.length) return [];
  const first = rows[0];
  const last = rows[rows.length - 1];
  return categories.map((c) => {
    const fSum = Number(first?.[c]?.sum ?? 0);
    const lSum = Number(last?.[c]?.sum ?? 0);
    const fIdx = Number(first?.[c]?.index ?? 100);
    const lIdx = Number(last?.[c]?.index ?? 100);
    return {
      cat: c,
      deltaSum: Math.max(0, lSum - fSum),
      deltaIdx: lIdx - fIdx,
    };
  });
}
