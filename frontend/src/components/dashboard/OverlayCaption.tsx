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
  useIndex = false, // 유지: 외부 시그니처 호환용
}: {
  series: CategoryPoint[];
  categories: string[];
  window?: number;
  useIndex?: boolean; // 호환용(표시는 sum/index 둘 다 요약)
}) {
  if (!series?.length || !categories?.length) return null;

  // 날짜 오름차순 + 최근 window 구간
  const rows = React.useMemo(() => {
    const arr = [...series].sort((a, b) => (a.date < b.date ? -1 : 1));
    return arr.slice(Math.max(0, arr.length - window));
  }, [series, window]);

  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return null;

  // 카테고리별 베이스→최신 요약
  const summary = categories.map((c) => {
    const baseSum = Number(first?.[c]?.sum ?? 0);
    const baseIdx = Number(first?.[c]?.index ?? 100);
    const curSum  = Number(last?.[c]?.sum ?? 0);
    const curIdx  = Number(last?.[c]?.index ?? 100);

    // Δ 합계(음수는 0으로 클램프해 '증가 기여'를 강조)
    const deltaSum = Math.max(0, curSum - baseSum);
    // Δ 지수(상대지수는 방향성 보존)
    const deltaIdx = curIdx - baseIdx;

    return {
      cat: c,
      baseSum, curSum, deltaSum,
      baseIdx, curIdx, deltaIdx,
    };
  });

  // 상승 기여(Δ Sum) TOP
  const topByDeltaSum = [...summary].sort((a, b) => b.deltaSum - a.deltaSum)[0];

  return (
    <div className="text-[11px] leading-5 text-gray-600">
      {/* 기간 표기 */}
      <div className="mb-0.5 text-gray-500">
        기간: <span className="font-medium">{first.date}</span>
        {' → '}
        <span className="font-medium">{last.date}</span>
      </div>

      {/* 최신 주 값(합계) 스냅샷 */}
      <div>
        최신 주(합계):{' '}
        {summary.map((s, i) => (
          <span key={s.cat}>
            <b>{s.cat}</b> {fmt(Math.round(s.curSum))}
            {i < summary.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>

      {/* 베이스→최신 변화 요약 (Δ Sum / Δ Index) */}
      <div className="mt-0.5">
        변화(베이스→최신):{' '}
        {summary.map((s, i) => {
          const signIdx = s.deltaIdx >= 0 ? '+' : '';
          return (
            <span key={s.cat}>
              <b>{s.cat}</b>{' '}
              {/* Δ Sum: 증가 기여를 강조 (클램프) */}
              +{fmt(Math.round(s.deltaSum))}
              {' / '}
              {/* Δ Index: 방향성 표시 */}
              {signIdx}
              {s.deltaIdx.toFixed(1)}
              {i < summary.length - 1 ? ', ' : ''}
            </span>
          );
        })}
        {topByDeltaSum && (
          <>
            {' '}· 상승 기여 최대: <b>{topByDeltaSum.cat}</b> (+{fmt(Math.round(topByDeltaSum.deltaSum))})
          </>
        )}
      </div>
    </div>
  );
}
