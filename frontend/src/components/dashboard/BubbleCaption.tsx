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
    return (
      <div className="text-sm text-gray-500">
        이번 주엔 유의미한 변화가 적어요. 다음 주에 다시 확인해 주세요.
      </div>
    );
  }

  // ── 한 줄 헤더(친근 톤)
  const Head = () => (
    <div className="text-[12px] font-semibold text-gray-900">
      이번 주에 특히 주목받은 브랜드는?
    </div>
  );

  // ── 안전한 지표 계산
  const rows = data.map((d) => {
    const A = Math.max(0, Number(d.base_sum ?? 0));
    const B = Math.max(0, Number(d.current_sum ?? 0));
    const D = Number.isFinite(Number(d.delta_sum)) ? Number(d.delta_sum) : 0;

    const pctRaw = A > 0 ? (B / A - 1) * 100 : (B > 0 ? 100 : 0);
    const pct = Number.isFinite(pctRaw) ? pctRaw : 0;

    const effRaw = A > 0 ? D / A : 0; // A=0이면 효율 정의 곤란 → 0
    const eff = Number.isFinite(effRaw) ? effRaw : 0;

    return { brand: d.brand, A, B, D, pct, eff };
  });

  // 데이터가 모두 0인지 체크
  const nonZero = rows.some((r) => r.A > 0 || r.B > 0 || r.D !== 0);
  if (!nonZero) {
    return (
      <div className="text-sm text-gray-500">
        변화가 거의 없었습니다{periodLabel ? ` · ${periodLabel}` : ''}.
      </div>
    );
  }

  // ── 순위/대표 후보
  const byDeltaDesc = [...rows].sort((a, b) => b.D - a.D);
  const byDeltaAsc = [...rows].sort((a, b) => a.D - b.D);
  const inc1 = byDeltaDesc[0];
  const dec1 = byDeltaAsc[0];

  const Avals = rows.map((r) => r.A).sort((a, b) => a - b);
  const pickQ = (q: number) =>
    Avals.length ? Avals[Math.max(0, Math.min(Avals.length - 1, Math.floor(q * (Avals.length - 1))))] : 0;
  const q50 = pickQ(0.5);
  const q75 = pickQ(0.75);

  const bigBaseTop = rows.filter((r) => r.A >= q75).sort((a, b) => b.D - a.D)[0];
  const effTop = rows.filter((r) => r.D > 0 && r.A > 0).sort((a, b) => b.eff - a.eff)[0];
  const emergingTop = rows.filter((r) => r.A < q50).sort((a, b) => b.D - a.D)[0];
  const established = rows.filter((r) => r.A >= q75).sort((a, b) => b.A - a.A)[0];

  // ── 간결한 불릿(중복 최소화)
  const bullets: string[] = [];
  const used = new Set<string>();

  if (inc1) {
    bullets.push(`절대 증가 TOP: ${inc1.brand} (Δ ${fmtNumber(inc1.D)}, A ${fmtNumber(inc1.A)} → B ${fmtNumber(inc1.B)}, ${fmtPercent(inc1.pct)})`);
    used.add(inc1.brand);
  }
  if (bigBaseTop && !used.has(bigBaseTop.brand)) {
    bullets.push(`규모 상위권 상승: ${bigBaseTop.brand} (Δ ${fmtNumber(bigBaseTop.D)})`);
    used.add(bigBaseTop.brand);
  }
  if (effTop && !used.has(effTop.brand)) {
    bullets.push(`증가 효율 우수(Δ/A): ${effTop.brand} (Δ ${fmtNumber(effTop.D)} / A ${fmtNumber(effTop.A)})`);
    used.add(effTop.brand);
  }
  if (emergingTop && !used.has(emergingTop.brand)) {
    bullets.push(`급부상(소규모→급증): ${emergingTop.brand}`);
    used.add(emergingTop.brand);
  }
  if (dec1 && dec1.D < 0 && !used.has(dec1.brand)) {
    bullets.push(`감소 폭 TOP: ${dec1.brand} (Δ ${fmtNumber(dec1.D)}, A ${fmtNumber(dec1.A)} → B ${fmtNumber(dec1.B)})`);
  }

  return (
    <div className="text-sm text-gray-700 leading-6">
      <Head />
      <div className="mt-0.5 text-gray-500">
        오른쪽일수록 원래 규모가 크고, 위로 갈수록 이번 주 증가가 커요{periodLabel ? ` · ${periodLabel}` : ''}.
      </div>

      {(inc1 || established) && (
        <div className="mt-2">
          <span className="font-semibold text-gray-900">요즘 뜨는 브랜드</span>:{' '}
          <span className="font-semibold">{inc1?.brand ?? '—'}</span>
          {' · '}
          <span className="font-semibold text-gray-900">전통 강자</span>:{' '}
          <span className="font-semibold">{established?.brand ?? '—'}</span>
        </div>
      )}

      <ul className="list-disc pl-5 space-y-1 mt-2">
        {bullets.slice(0, maxLines).map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
