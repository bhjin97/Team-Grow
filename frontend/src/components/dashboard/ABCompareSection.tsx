'use client';

import * as React from 'react';
import { fmtNumber } from '@/settings/trends';

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

  return (
    <div className="text-sm text-gray-700 leading-6">
      {/* 읽는 법 */}
      <div className="text-gray-600">
        <b>이번 주(B)와 지난 주(A)를 단순 비교</b>했어요. Δ는 B−A, 즉 한 주 사이에 얼마나 늘었는지예요.
        <span className="text-gray-500"> (A={aDate} → B={bDate})</span>
      </div>

      {/* 하이라이트 1줄 */}
      {(t || b) && (
        <div className="mt-0.5">
          {t && (
            <>
              가장 오른 브랜드: <b>{t.brand}</b> (Δ {fmtNumber(t.delta)}
              {t.pct >= 0 ? `, +${t.pct.toFixed(1)}%` : `, ${t.pct.toFixed(1)}%`})
            </>
          )}
          {t && b && ' · '}
          {b && (
            <>
              가장 빠진 브랜드: <b>{b.brand}</b> (Δ {fmtNumber(b.delta)}
              {b.pct >= 0 ? `, +${b.pct.toFixed(1)}%` : `, ${b.pct.toFixed(1)}%`})
            </>
          )}
          .
        </div>
      )}
    </div>
  );
}
