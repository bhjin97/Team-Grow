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

    const deltaSum = Math.max(0, curSum - baseSum); // 감소는 0으로 보정
    const deltaIdx = curIdx - baseIdx;             // 방향성 보존

    return { cat: c, baseSum, curSum, deltaSum, baseIdx, curIdx, deltaIdx };
  });

  const topByDeltaSum = [...summary].sort((a, b) => b.deltaSum - a.deltaSum)[0];

  return (
    <div className="text-[11px] leading-5 text-gray-700">
      {/* 읽는 법 + 기간 */}
      <div className="mb-0.5 text-gray-600">
        선이 <b>위로 갈수록 최근까지 더 많이 늘었다</b>는 뜻이에요. (
        <span className="text-gray-500">
          {first.date} → {last.date}
        </span>
        )
      </div>

      {/* 최신 주 스냅샷 */}
      <div>
        최신 주 합계:{' '}
        {summary.map((s, i) => (
          <span key={s.cat}>
            <b>{s.cat}</b> {fmt(Math.round(s.curSum))}
            {i < summary.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>

      {/* 변화 요약 */}
      <div className="mt-0.5">
        변화(베이스→최신):{' '}
        {summary.map((s, i) => {
          const signIdx = s.deltaIdx >= 0 ? '+' : '';
          return (
            <span key={s.cat}>
              <b>{s.cat}</b> +{fmt(Math.round(s.deltaSum))} / {signIdx}
              {s.deltaIdx.toFixed(1)}
              {i < summary.length - 1 ? ', ' : ''}
            </span>
          );
        })}
        {topByDeltaSum && (
          <> · 가장 많이 오른 카테고리: <b>{topByDeltaSum.cat}</b></>
        )}
      </div>
    </div>
  );
}
