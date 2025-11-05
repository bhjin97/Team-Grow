'use client';

import * as React from 'react';

type CategoryPoint = {
  date: string;
  // 각 키: { sum:number, index:number }
  [cat: string]: any;
};

function fmt(n: number) {
  return n.toLocaleString();
}

export default function OverlayCaption({
  series,
  categories,
  window = 8,
  useIndex = false,
}: {
  series: CategoryPoint[];
  categories: string[];
  window?: number;
  useIndex?: boolean; // true면 index, false면 sum
}) {
  if (!series?.length || !categories?.length) return null;

  const rows = [...series].slice(-window);
  const last = rows[rows.length - 1];
  const prev = rows.length >= 2 ? rows[rows.length - 2] : null;

  const lines = categories.map((c) => {
    const cur = Number(last?.[c]?.[useIndex ? 'index' : 'sum'] ?? 0);
    const pre = Number(prev?.[c]?.[useIndex ? 'index' : 'sum'] ?? 0);
    const d = cur - pre;
    const pct = pre > 0 ? ((cur / pre) - 1) * 100 : cur > 0 ? 100 : 0;
    return { c, cur, pre, d, pct };
  });

  // 상승폭 TOP1
  const topUp = [...lines].sort((a, b) => b.d - a.d)[0];

  return (
    <div className="text-[11px] leading-5 text-gray-600">
      <div>
        최근 {window}주 추이. 마지막 주 기준:{' '}
        {lines.map((x, i) => (
          <span key={x.c}>
            <b>{x.c}</b> {fmt(Math.round(x.cur))}
            {i < lines.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>
      {prev && (
        <div className="mt-0.5">
          전주 대비 변화:{' '}
          {lines.map((x, i) => (
            <span key={x.c}>
              <b>{x.c}</b>{' '}
              {x.d >= 0 ? '+' : ''}
              {fmt(Math.round(x.d))} ({x.pct >= 0 ? '+' : ''}
              {x.pct.toFixed(1)}%)
              {i < lines.length - 1 ? ', ' : ''}
            </span>
          ))}
          {topUp && (
            <>
              {' '}· 상승폭 최대: <b>{topUp.c}</b> (
              {topUp.d >= 0 ? '+' : ''}
              {fmt(Math.round(topUp.d))})
            </>
          )}
        </div>
      )}
    </div>
  );
}
