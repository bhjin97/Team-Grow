'use client';

import * as React from 'react';
import { fmtNumber, fmtPercent } from '@/settings/trends';

/* ─────────────────────────────
 * 작은 유틸 (NaN/무한대 방지 + pp 포맷)
 * ───────────────────────────── */
const toNumber = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const fmtPP = (v: number) => `${(toNumber(v)).toFixed(1)}pp`;

/* ─────────────────────────────
 * 1) 도넛 캡션 (주간 Δ 비중)
 * ───────────────────────────── */
export function CategoryDonutCaption({
  current,
  prev,
  weekLabel,
}: {
  current: { label: string; value: number }[];
  prev?:   { label: string; value: number }[];
  weekLabel: string;
}) {
  if (!current || current.length === 0) return null;

  // 현재 주 비중
  const total = current.reduce((s, x) => s + toNumber(x.value, 0), 0) || 1;
  const sorted = [...current].sort((a, b) => toNumber(b.value, 0) - toNumber(a.value, 0));
  const major = sorted[0];
  const majorShare = Math.round((toNumber(major?.value, 0) / total) * 100);

  // 전주 대비 pp 변화(있을 때만)
  let deltaLine: string | null = null;
  if (prev && prev.length) {
    const prevMap = new Map(prev.map(d => [d.label, toNumber(d.value, 0)]));
    const prevTotal = Array.from(prevMap.values()).reduce((s, v) => s + v, 0) || 1;

    let upCat = '';   let upDiff = -Infinity;
    let downCat = ''; let downDiff =  Infinity;

    for (const { label, value } of current) {
      const nowP  = (toNumber(value, 0) / total) * 100;
      const prevP = (toNumber(prevMap.get(label), 0) / prevTotal) * 100;
      const diff  = nowP - prevP;
      if (diff > upDiff)   { upDiff = diff; upCat = label; }
      if (diff < downDiff) { downDiff = diff; downCat = label; }
    }
    if (Number.isFinite(upDiff) && Number.isFinite(downDiff)) {
      deltaLine = `직전 주 대비 변화: ${upCat} +${fmtPP(upDiff)} · ${downCat} ${fmtPP(downDiff)}`;
    }
  }

  return (
    <div className="text-sm text-gray-700 leading-6">
      <div className="font-semibold text-gray-900">이번 주 카테고리 한눈요약</div>
      <div>
        {weekLabel} 기준, <b>{major?.label ?? '—'}</b> 비중이 <b>{majorShare}%</b>로 가장 커요.
      </div>
      {deltaLine ? (
        <div className="text-gray-600">{deltaLine}</div>
      ) : (
        <div className="text-gray-500">직전 주 데이터가 없어 변화 비교는 생략했어요.</div>
      )}
    </div>
  );
}

/* ─────────────────────────────
 * 2) 스몰 멀티플 캡션 (최근 N주)
 *    - sum 기준(정규화된 시계열이면 그 값을 그대로 사용)
 * ───────────────────────────── */
export function SmallMultiplesCaption({
  series,
  categories,
  window = 8,
}: {
  series: any[]; // { date, [cat]:{sum,index} }
  categories: string[];
  window?: number;
}) {
  if (!series?.length || !categories?.length) return null;

  const last = series.slice(-window);

  const stats = categories.map((c) => {
    const vals = last.map((r) => toNumber(r?.[c]?.sum, 0));
    // 주간 변화량(Δ) 분산으로 ‘들썩임’ 측정
    const diffs = vals.slice(1).map((v, i) => v - vals[i]);
    const variance =
      diffs.length > 0
        ? diffs.reduce((s, v) => s + v * v, 0) / diffs.length
        : 0;

    // 구간 누적 증가량
    const delta = toNumber(vals.at(-1), 0) - toNumber(vals[0], 0);
    return { cat: c, variance, delta };
  });

  const byVol = [...stats].sort((a, b) => b.variance - a.variance);
  const byInc = [...stats].sort((a, b) => b.delta - a.delta);
  const byFlat = [...stats].sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta));

  const volatile = byVol[0]?.cat ?? '—';
  const incTop = byInc.slice(0, 2).map((x) => x.cat).filter(Boolean);
  const flat = byFlat[0]?.cat ?? '—';

  return (
    <div className="text-sm text-gray-700 leading-6">
      <div className="font-semibold text-gray-900">최근 {window}주 흐름 요약</div>
      <div>
        가장 들썩: <b>{volatile}</b> · 가파른 상승: <b>{incTop.join(', ') || '—'}</b>
      </div>
      <div className="text-gray-600">잔잔한 카테고리: {flat}</div>
    </div>
  );
}

/* ─────────────────────────────
 * 3) A/B 비교 캡션 (브랜드 탑/바텀)
 * ───────────────────────────── */
export function ABCompareCaption({
  aDate,
  bDate,
  top,
  bottom,
}: {
  aDate: string;
  bDate: string;
  top?: { brand: string; delta: number; pct: number }[];
  bottom?: { brand: string; delta: number; pct: number }[];
}) {
  const t = top?.[0];
  const b = bottom?.[0];

  const tPct = Number.isFinite(Number(t?.pct)) ? Number(t!.pct).toFixed(1) : '0.0';
  const bPct = Number.isFinite(Number(b?.pct)) ? Number(b!.pct).toFixed(1) : '0.0';

  return (
    <div className="text-sm text-gray-700 leading-6">
      <div className="font-semibold text-gray-900">이번 주 A/B 비교</div>
      <div className="text-gray-600">기준: A={aDate} → B={bDate} (Δ = B−A)</div>

      {(t || b) && (
        <div className="mt-1">
          {t && (
            <>
              상승 TOP: <b>{t.brand}</b> (Δ {fmtNumber(t.delta)}, {Number(tPct) >= 0 ? '+' : ''}
              {tPct}%)
            </>
          )}
          {t && b && ' · '}
          {b && (
            <>
              하락 TOP: <b>{b.brand}</b> (Δ {fmtNumber(b.delta)}, {Number(bPct) >= 0 ? '+' : ''}
              {bPct}%)
            </>
          )}
        </div>
      )}
    </div>
  );
}
