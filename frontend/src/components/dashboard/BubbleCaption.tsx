'use client';

import * as React from 'react';
import { fmtNumber, fmtPercent } from '@/settings/trends';

type BrandItem = {
  brand: string;
  base_sum: number | null;
  current_sum: number | null;
  delta_sum: number | null;
};

export default function BubbleCaption({
  data,
  periodLabel,
  maxLines = 4,
}: {
  data: BrandItem[];
  periodLabel?: string;
  maxLines?: number;
}) {
  if (!data || data.length === 0) {
    return <div className="text-sm text-gray-500">이번 주엔 유의미한 변화가 적어요. 다음 주에 다시 확인해 주세요.</div>;
  }

  const rows = data.map((d) => {
    const A = Math.max(0, Number(d.base_sum ?? 0));
    const B = Math.max(0, Number(d.current_sum ?? 0));
    const D = Number(d.delta_sum ?? 0);
    return {
      brand: d.brand,
      A, B, D,
      pct: A > 0 ? ((B / A) - 1) * 100 : (B > 0 ? 100 : 0),
      eff: A > 0 ? D / A : (D > 0 ? Number.POSITIVE_INFINITY : 0),
    };
  });

  const byDeltaDesc = [...rows].sort((a, b) => b.D - a.D);
  const byDeltaAsc  = [...rows].sort((a, b) => a.D - b.D);
  const inc1 = byDeltaDesc[0];
  const dec1 = byDeltaAsc[0];

  const Avals = rows.map(r => r.A).sort((a,b) => a-b);
  const q50 = Avals[Math.floor(0.50*(Avals.length-1))] ?? 0;
  const q75 = Avals[Math.floor(0.75*(Avals.length-1))] ?? 0;

  const bigBaseTop  = rows.filter(r => r.A >= q75).sort((a,b)=> b.D - a.D)[0];
  const effTop      = rows.filter(r => r.D > 0).sort((a,b)=> b.eff - a.eff)[0];
  const emergingTop = rows.filter(r => r.A < q50).sort((a,b)=> b.D - a.D)[0];
  const established = rows.filter(r => r.A >= q75).sort((a,b)=> b.A - a.A)[0];

  const bullets: string[] = [];
  if (inc1) bullets.push(`이번 주 절대 증가 1위는 ${inc1.brand} (Δ ${fmtNumber(inc1.D)}, A ${fmtNumber(inc1.A)} → B ${fmtNumber(inc1.B)}, ${fmtPercent(inc1.pct)}).`);
  if (bigBaseTop && bigBaseTop.brand !== inc1?.brand) bullets.push(`대규모 집단(A 상위 25%)에선 ${bigBaseTop.brand}가 가장 많이 늘었어요 (Δ ${fmtNumber(bigBaseTop.D)}).`);
  if (effTop && effTop.brand !== inc1?.brand) bullets.push(`증가 효율(Δ/A) 기준에선 ${effTop.brand}가 두드러집니다 (Δ ${fmtNumber(effTop.D)} / A ${fmtNumber(effTop.A)}).`);
  if (emergingTop && emergingTop.brand !== inc1?.brand) bullets.push(`신흥 강자로는 ${emergingTop.brand}에 주목! 규모는 작지만 이번 주 급상승.`);
  if (dec1 && dec1.D < 0) bullets.push(`감소 폭이 큰 브랜드는 ${dec1.brand} (Δ ${fmtNumber(dec1.D)}, A ${fmtNumber(dec1.A)} → B ${fmtNumber(dec1.B)}).`);

  return (
    <div className="text-sm text-gray-700 leading-6">
      <div className="mb-1 text-gray-600">
        읽는 법 · X축은 누적 리뷰 수(A), Y축은 이번 주 증가(Δ)예요. 오른쪽일수록 규모, 위로 갈수록 급상승입니다{periodLabel ? ` · ${periodLabel}` : ''}.
      </div>
      {(inc1 || established) && (
        <div className="mb-2">
          <span className="font-semibold text-gray-900">요즘 뜨는 브랜드</span>: <span className="font-semibold">{inc1?.brand ?? '—'}</span>
          {' · '}
          <span className="font-semibold text-gray-900">전통 강자</span>: <span className="font-semibold">{established?.brand ?? '—'}</span>
        </div>
      )}
      <ul className="list-disc pl-5 space-y-1">
        {bullets.slice(0, maxLines).map((t, i)=> <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}