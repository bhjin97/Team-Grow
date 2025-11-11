'use client';

import * as React from 'react';

type CategoryPoint = {
  date: string;
  // 각 키: { sum:number, index:number }
  [cat: string]: any;
};

const toNum = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const fmt = (n: number) => toNum(n).toLocaleString();

export default function OverlayCaption({
  series,
  categories,
  window = 8,
  useIndex = false,
}: {
  series: CategoryPoint[];
  categories: string[];
  window?: number;
  useIndex?: boolean;
}) {
  if (!series?.length || !categories?.length) return null;

  // 최근 window 구간(오름차순)
  const rows = React.useMemo(() => {
    const arr = [...series].sort((a, b) => (a.date < b.date ? -1 : 1));
    return arr.slice(Math.max(0, arr.length - window));
  }, [series, window]);

  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return null;

  // 베이스→최신 요약
  const summary = categories.map((c) => {
    const baseSum = toNum(first?.[c]?.sum, 0);
    const baseIdx = toNum(first?.[c]?.index, 100);
    const curSum  = toNum(last?.[c]?.sum, 0);
    const curIdx  = toNum(last?.[c]?.index, 100);

    const deltaSum = Math.max(0, curSum - baseSum); // 감소는 0으로 보정(기여 강조)
    const deltaIdx = curIdx - baseIdx;             // 방향성 보존

    return { cat: c, baseSum, curSum, deltaSum, baseIdx, curIdx, deltaIdx };
  });

  const topByDeltaSum = [...summary].sort((a, b) => b.deltaSum - a.deltaSum)[0];

  return (
    <div className="text-[11px] leading-5 text-gray-800">
      {/* 섹션 뱃지 + 기간 */}
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #9b87f5 0%, #7c3aed 100%)' }}
        >
          누적 Δ 추이
        </span>
        <span className="text-gray-600">
          선이 <b>위로 갈수록 최근까지 더 많이 늘었다</b>는 뜻이에요 ·{' '}
          <span className="text-gray-500">{first.date} → {last.date}</span>
        </span>
      </div>

      {/* 최신 주 합계: 카테고리별 칩 */}
      <div className="flex flex-wrap gap-1.5">
        {summary.map((s) => (
          <span
            key={`cur-${s.cat}`}
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5"
          >
            <b className="mr-1 text-gray-900">{s.cat}</b>
            <span className="text-gray-700">{fmt(Math.round(s.curSum))}</span>
          </span>
        ))}
      </div>

      {/* 변화 요약 */}
      <div className="mt-1.5">
        <div className="flex flex-wrap gap-1.5">
          {summary.map((s) => {
            const signIdx = s.deltaIdx >= 0 ? '+' : '';
            const pos = s.deltaIdx > 0;
            const neg = s.deltaIdx < 0;
            return (
              <span
                key={`chg-${s.cat}`}
                className={`inline-flex items-center rounded-full px-2 py-0.5 border text-[10px] ${
                  pos
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : neg
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
                title={`${s.cat} ΔSum +${fmt(Math.round(s.deltaSum))} / ΔIdx ${signIdx}${s.deltaIdx.toFixed(1)}`}
              >
                <b className="mr-1">{s.cat}</b>
                +{fmt(Math.round(s.deltaSum))} / {signIdx}{s.deltaIdx.toFixed(1)}
              </span>
            );
          })}
        </div>

        {topByDeltaSum && (
          <div className="mt-1 inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-800 text-[10px]">
            🔎 가장 많이 오른 카테고리: <b className="ml-1">{topByDeltaSum.cat}</b> (
            +{fmt(Math.round(topByDeltaSum.deltaSum))})
          </div>
        )}
      </div>
    </div>
  );
}
