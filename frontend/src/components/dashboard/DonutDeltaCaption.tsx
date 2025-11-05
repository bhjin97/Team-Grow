'use client';

import * as React from 'react';

type Slice = { label: string; value: number };

function fmt(n: number) {
  return n.toLocaleString();
}

export default function DonutDeltaCaption({
  current,
  prev,
  weekLabel,
}: {
  current: Slice[];
  prev?: Slice[];
  weekLabel?: string;
}) {
  if (!current || current.length === 0) return null;

  const curTotal = current.reduce((s, d) => s + (d.value || 0), 0);
  const prevTotal = prev?.reduce((s, d) => s + (d.value || 0), 0) ?? 0;

  // 비중(%) 계산
  const curPct = (v: number) => (curTotal > 0 ? (v / curTotal) * 100 : 0);
  const prevPctMap = new Map<string, number>(
    (prev ?? []).map((d) => [d.label, prevTotal > 0 ? (d.value / prevTotal) * 100 : 0]),
  );

  // 가장 큰 비중/증가 절대량 pick
  const topByShare = [...current].sort((a, b) => curPct(b.value) - curPct(a.value))[0];
  const topByDelta = [...current]
    .map((d) => {
      const p = (prev ?? []).find((x) => x.label === d.label)?.value ?? 0;
      return { label: d.label, delta: d.value - p, cur: d.value, prev: p };
    })
    .sort((a, b) => b.delta - a.delta)[0];

  return (
    <div className="text-[11px] leading-5 text-gray-600">
      <div>
        {weekLabel ? `${weekLabel} 기준 ` : ''}증가 리뷰 합계 <b>{fmt(curTotal)}</b>.
      </div>
      {topByShare && (
        <div>
          가장 큰 비중은 <b>{topByShare.label}</b> (
          {curPct(topByShare.value).toFixed(1)}
          %).
          {prev && (
            <>
              {' '}
              전주 대비{' '}
              {(
                curPct(topByShare.value) - (prevPctMap.get(topByShare.label) ?? 0)
              ).toFixed(1)}
              pp
            </>
          )}
        </div>
      )}
      {topByDelta && (
        <div>
          증가량이 가장 큰 카테고리는 <b>{topByDelta.label}</b> (
          {topByDelta.delta >= 0 ? '+' : ''}
          {fmt(topByDelta.delta)}).
        </div>
      )}
    </div>
  );
}
