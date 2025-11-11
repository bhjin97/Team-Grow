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
    <div className="text-[11px] leading-5 text-gray-800">
      {/* 헤더 뱃지 + 한 줄 가이드 */}
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #b4a2f8 0%, #9b87f5 100%)' }}
        >
          Δ 비중
        </span>
        <span className="text-gray-600">
          {weekLabel ? <b>{weekLabel}</b> : '이번 주'} 기준, <b>새로 늘어난 리뷰</b>의 카테고리 몫이에요.
        </span>
      </div>

      {/* 총합 및 하이라이트 칩 */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px]">
          이번 주 Δ <b className="ml-1">{fmt(curTotal)}</b>
        </span>
        {prev && (
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-600">
            지난 주 Δ {fmt(prevTotal)}
          </span>
        )}
        {topByShare && (
          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] text-amber-800">
            최대 비중 <b className="ml-1">{topByShare.label}</b> ({curPct(topByShare.value).toFixed(1)}%)
          </span>
        )}
        {topByDelta && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] text-emerald-800">
            Δ 최고 <b className="ml-1">{topByDelta.label}</b>{' '}
            ({topByDelta.delta >= 0 ? '+' : ''}{fmt(topByDelta.delta)})
          </span>
        )}
      </div>

      {/* 카테고리별 한 줄 표 */}
      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="text-gray-900 font-medium">{r.label}</span>

            <span
              className={`ml-auto inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                r.delta > 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : r.delta < 0
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-gray-50 text-gray-600 border border-gray-200'
              }`}
            >
              {r.delta > 0 ? '↑' : r.delta < 0 ? '↓' : '·'} {r.delta >= 0 ? '+' : ''}{fmt(r.delta)}
            </span>

            <span className="text-gray-500">• {r.curShare.toFixed(1)}%</span>

            {prev && (
              <span
                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] ${
                  r.pp > 0 ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' :
                  r.pp < 0 ? 'text-rose-700 bg-rose-50 border border-rose-200' :
                              'text-gray-500 bg-gray-50 border border-gray-200'
                }`}
              >
                {r.pp > 0 ? '▲' : r.pp < 0 ? '▼' : '→'} {Math.abs(r.pp).toFixed(1)}pp
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
