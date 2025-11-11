'use client';

import * as React from 'react';

type Slice = { label: string; value: number };

const fmt = (n: number) => n.toLocaleString();

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

  // 합계 및 비중(%)
  const curTotal = current.reduce((s, d) => s + (d.value || 0), 0);
  const prevTotal = prev?.reduce((s, d) => s + (d.value || 0), 0) ?? 0;
  const curPct = (v: number) => (curTotal > 0 ? (v / curTotal) * 100 : 0);

  const prevMap = new Map<string, number>((prev ?? []).map(d => [d.label, d.value || 0]));
  const prevPctMap = new Map<string, number>(
    (prev ?? []).map(d => [d.label, prevTotal > 0 ? ((d.value || 0) / prevTotal) * 100 : 0]),
  );

  // 비중 TOP / 증가 Δ TOP
  const topByShare = [...current].sort((a, b) => curPct(b.value) - curPct(a.value))[0];
  const deltas = current.map(d => {
    const pv = prevMap.get(d.label) ?? 0;
    return { label: d.label, cur: d.value || 0, prev: pv, delta: (d.value || 0) - pv };
  });
  const topByDelta = [...deltas].sort((a, b) => b.delta - a.delta)[0];

  // 표용 가공
  const rows = current
    .map(d => {
      const cur = d.value || 0;
      const curShare = curPct(cur);
      const prevShare = prevPctMap.get(d.label) ?? 0;
      return {
        label: d.label,
        cur,
        curShare,
        prev: prevMap.get(d.label) ?? 0,
        prevShare,
        delta: cur - (prevMap.get(d.label) ?? 0),
        pp: curShare - prevShare,
      };
    })
    .sort((a, b) => b.curShare - a.curShare);

  return (
    <div className="text-[11px] leading-5 text-gray-700">
      {/* 한 줄 요약 + 읽는 법 */}
      <div className="text-gray-600">
        {weekLabel ? `${weekLabel} 기준, ` : ''}
        <b>이번 주 새로 늘어난 리뷰</b>를 파이로 나눠 보여줘요. 조각이 클수록 이번 주 기여도가 큰 거예요.
      </div>

      {/* 총합 정보 */}
      <div className="mt-0.5">
        이번 주 증가 합계 <b>{fmt(curTotal)}</b>
        {prev && <> (지난주 {fmt(prevTotal)})</>}
        .
      </div>

      {/* 하이라이트 두 줄 */}
      {topByShare && (
        <div>
          가장 큰 몫: <b>{topByShare.label}</b> ({curPct(topByShare.value).toFixed(1)}%)
          {prev && (
            <> / 전주 대비 {(curPct(topByShare.value) - (prevPctMap.get(topByShare.label) ?? 0)).toFixed(1)}pp</>
          )}
          .
        </div>
      )}
      {topByDelta && (
        <div>
          이번 주에 <b>가장 많이 늘어난</b> 곳: <b>{topByDelta.label}</b>{' '}
          ({topByDelta.delta >= 0 ? '+' : ''}
          {fmt(topByDelta.delta)}).
        </div>
      )}

      {/* 카테고리별 한 줄 표 */}
      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="text-gray-800">{r.label}</span>
            <span className="ml-auto font-medium">{r.delta >= 0 ? '+' : ''}{fmt(r.delta)}</span>
            <span className="text-gray-500">• {r.curShare.toFixed(1)}%</span>
            {prev && (
              <span
                className={
                  r.pp > 0 ? 'text-emerald-700' : r.pp < 0 ? 'text-rose-700' : 'text-gray-400'
                }
              >
                {r.pp > 0 ? '↑' : r.pp < 0 ? '↓' : '→'} {Math.abs(r.pp).toFixed(1)}pp
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
