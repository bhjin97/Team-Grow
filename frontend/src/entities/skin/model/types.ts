export type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';

export interface AxisBrief {
  avg: number;
  letter: string;
  confidence: number;
}

export type AxesJSON = Record<AxisKey, AxisBrief>;

export interface SkinConcern {
  key: AxisKey;
  label: string;
  value: number;
}

export interface SkinTypeData {
  baumannType: string; // e.g., "ORNT"
  axes: AxesJSON | null;
  koAxisWord: Record<AxisKey, string>;
  concerns: SkinConcern[];
}

// 축 라벨 매핑
export const AXIS_LABELS: Record<string, { left: string; right: string }> = {
  OILY: { left: 'OILY', right: 'DRY' },
  DRY: { left: 'DRY', right: 'OILY' },
  RESISTANCE: { left: 'RESISTANCE', right: 'SENSITIVE' },
  SENSITIVE: { left: 'SENSITIVE', right: 'RESISTANCE' },
  'NON-PIGMENTED': { left: 'NON-PIGMENTED', right: 'PIGMENTED' },
  PIGMENTED: { left: 'PIGMENTED', right: 'NON-PIGMENTED' },
  TIGHT: { left: 'TIGHT', right: 'WRINKLED' },
  WRINKLED: { left: 'WRINKLED', right: 'TIGHT' },
};

// 축별 컬러
export const AXIS_COLORS: Record<AxisKey, { main: string; soft: string }> = {
  OD: { main: '#06b6d4', soft: 'rgba(6,182,212,0.15)' },
  SR: { main: '#f472b6', soft: 'rgba(244,114,182,0.18)' },
  PN: { main: '#a78bfa', soft: 'rgba(167,139,250,0.18)' },
  WT: { main: '#34d399', soft: 'rgba(52,211,153,0.18)' },
};

// 16타입 컬러
export const TYPE_COLORS: Record<string, string> = {
  OSNT: '#f472b6',
  OSNW: '#fb7185',
  OSPT: '#e879f9',
  OSPW: '#c084fc',
  ORNT: '#f43f5e',
  ORNW: '#f97316',
  ORPT: '#d946ef',
  ORPW: '#a78bfa',
  DSNT: '#60a5fa',
  DSNW: '#38bdf8',
  DSPT: '#34d399',
  DSPW: '#10b981',
  DRNT: '#22c55e',
  DRNW: '#84cc16',
  DRPT: '#06b6d4',
  DRPW: '#14b8a6',
};

/**
 * HEX를 RGBA로 변환
 */
export function hexToRgba(hex: string, alpha = 0.1): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 강도 접두사 (매우/꽤)
 */
export function intensityWord(pct: number): string {
  if (pct >= 95) return '매우 ';
  if (pct >= 90) return '꽤 ';
  return '';
}

/**
 * 한줄 요약 생성
 */
export function generateSkinSummary(
  koAxisWord: Record<AxisKey, string>,
  concerns: SkinConcern[]
): string {
  const pctByKey: Record<AxisKey, number> = {
    OD: concerns.find(c => c.key === 'OD')?.value ?? 0,
    SR: concerns.find(c => c.key === 'SR')?.value ?? 0,
    PN: concerns.find(c => c.key === 'PN')?.value ?? 0,
    WT: concerns.find(c => c.key === 'WT')?.value ?? 0,
  };

  return (
    `${intensityWord(pctByKey.OD)}${koAxisWord.OD}이고 ` +
    `${intensityWord(pctByKey.SR)}${koAxisWord.SR}예요. ` +
    `${intensityWord(pctByKey.PN)}${koAxisWord.PN}이고 ` +
    `${intensityWord(pctByKey.WT)}${koAxisWord.WT}예요.`
  );
}
