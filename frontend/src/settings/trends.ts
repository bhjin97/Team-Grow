// ───────────────────────────────────────────────
//  📘 중앙 설정 파일 : 시각화 · 포맷 · 라벨
// ───────────────────────────────────────────────

/** 🎨 색상 팔레트 */
export const PALETTE_BRAND = [
  '#9b87f5', // 보라 (기본)
  '#f5a2c0', // 핑크
  '#8bd3dd', // 하늘
  '#f6c667', // 노랑
  '#94a3b8', // 회색
  '#34d399', // 초록
  '#fb7185', // 코랄
];

export const PALETTE_CATEGORY = [
  '#9b87f5',
  '#f472b6',
  '#60a5fa',
  '#facc15',
  '#4ade80',
];

/** 📊 리스트 / 제한 */
export const TOP_LIST_LIMIT = 5;

/** ⚙️ 스케일 및 비율 상수 */
export const LOG_PAD_RATIO = 0.08;         // log 스케일 y패딩
export const BUBBLE_R_MIN = 6;             // 버블 최소 반경(px)
export const BUBBLE_R_MAX = 22;            // 버블 최대 반경(px)
export const HIT_RADIUS = 20;              // 모바일 히트 영역 반경(px)
export const TOOLTIP_PAD = 12;             // 툴팁 경계 여유(px)

/** 🧱 레이아웃 상수 */
export const MODAL_MAX_H = '90vh';
export const GRID_GAP = 16;
export const CARD_PAD = 16;
export const LEGEND_MIN_ITEM_WIDTH = 120;

/** 🕓 포맷 기본값 */
export const NUMBER_LOCALE = 'ko-KR';
export const PERCENT_DIGITS = 1;
export const DATE_FORMAT = 'YYYY-MM-DD';

/** 🧭 기능 플래그 */
export const SHOW_BUBBLE_QUADRANT = true; // Base 상위 25% 보조선 표시 여부

// ───────────────────────────────────────────────
//  🏷️ 라벨 사전 및 정렬 우선순위
// ───────────────────────────────────────────────
export const CATEGORY_LABELS: Record<
  string,
  { short: string; full: string }
> = {
  '스킨/토너': { short: '스킨', full: '스킨/토너' },
  '에센스/세럼/앰플': { short: '에센스', full: '에센스/세럼/앰플' },
  '크림': { short: '크림', full: '크림' },
  '선크림': { short: '선', full: '선크림' },
};

export const CATEGORY_ORDER = [
  '스킨/토너',
  '에센스/세럼/앰플',
  '크림',
  '선크림',
];

// ───────────────────────────────────────────────
//  🧮 포맷 유틸 (여기서 바로 사용 가능)
// ───────────────────────────────────────────────
export const fmtNumber = (n: number | null | undefined): string => {
  if (n == null || isNaN(Number(n))) return '0';
  return Number(n).toLocaleString(NUMBER_LOCALE);
};

export const fmtPercent = (value: number, digits = PERCENT_DIGITS): string => {
  if (isNaN(value)) return '0%';
  const pct = new Intl.NumberFormat(NUMBER_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return `${pct}%`;
};

export const fmtDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // YYYY-MM-DD만 출력 (dayjs나 luxon 없이 처리)
  return dateStr.split('T')[0];
};
