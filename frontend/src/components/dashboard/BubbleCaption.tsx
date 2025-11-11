'use client';

import * as React from 'react';
import { fmtNumber, fmtPercent } from '@/settings/trends';

type BrandItem = {
  brand: string;
  base_sum: number | null;
  current_sum: number | null;
  delta_sum: number | null;
};

function Pill({
  children,
  tone = 'indigo',
  className = '',
}: { children: React.ReactNode; tone?: 'indigo' | 'emerald' | 'rose' | 'slate'; className?: string }) {
  const tones: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200',
    slate: 'bg-slate-50 text-slate-700 ring-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

function Delta({ d }: { d: number }) {
  const sign = d >= 0 ? '+' : '';
  const tone = d >= 0 ? 'emerald' : 'rose';
  return <Pill tone={tone}>{sign}{fmtNumber(d)}</Pill>;
}

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

  // ── 안전한 지표 계산
  const rows = data.map((d) => {
    const A = Math.max(0, Number(d.base_sum ?? 0));
    const B = Math.max(0, Number(d.current_sum ?? 0));
    const D = Number.isFinite(Number(d.delta_sum)) ? Number(d.delta_sum) : 0;
    const pctRaw = A > 0 ? (B / A - 1) * 100 : (B > 0 ? 100 : 0);
    const pct = Number.isFinite(pctRaw) ? pctRaw : 0;
    const effRaw = A > 0 ? D / A : 0;
    const eff = Number.isFinite(effRaw) ? effRaw : 0;
    return { brand: d.brand, A, B, D, pct, eff };
  });

  // 모두 0인지 체크
  const nonZero = rows.some((r) => r.A > 0 || r.B > 0 || r.D !== 0);
  if (!nonZero) {
    return <div className="text-sm text-gray-500">변화가 거의 없었습니다{periodLabel ? ` · ${periodLabel}` : ''}.</div>;
  }

  // 순위/세그먼트
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

  // 불릿
  const bullets: React.ReactNode[] = [];
  const used = new Set<string>();

  if (inc1) {
    bullets.push(
      <li key="inc1">
        <span className="font-semibold text-slate-900">{inc1.brand}</span>가 <Pill tone="emerald">이번 주 증가 1위</Pill> 입니다.{' '}
        <Delta d={inc1.D} /> · A {fmtNumber(inc1.A)} → B {fmtNumber(inc1.B)} ({inc1.pct >= 0 ? '+' : ''}{inc1.pct.toFixed(1)}%)
      </li>
    );
    used.add(inc1.brand);
  }

  if (bigBaseTop && !used.has(bigBaseTop.brand)) {
    bullets.push(
      <li key="big">
        <Pill tone="indigo">대규모 그룹</Pill>에서 <span className="font-semibold text-indigo-700">{bigBaseTop.brand}</span>가
        가장 많이 늘었어요. <Delta d={bigBaseTop.D} />
      </li>
    );
    used.add(bigBaseTop.brand);
  }

  if (effTop && !used.has(effTop.brand)) {
    bullets.push(
      <li key="eff">
        <Pill tone="emerald">증가 효율</Pill> 기준으론 <span className="font-semibold text-emerald-700">{effTop.brand}</span>가 돋보여요. Δ/A = {(effTop.eff*100).toFixed(1)}%
      </li>
    );
    used.add(effTop.brand);
  }

  if (emergingTop && !used.has(emergingTop.brand)) {
    bullets.push(
      <li key="emerging">
        <Pill tone="slate">신흥 강자</Pill>는 <span className="font-semibold text-slate-900">{emergingTop.brand}</span>. 규모는 작지만 급상승!
      </li>
    );
    used.add(emergingTop.brand);
  }

  if (dec1 && dec1.D < 0 && !used.has(dec1.brand)) {
    bullets.push(
      <li key="dec">
        감소 폭이 큰 브랜드는 <span className="font-semibold text-rose-700">{dec1.brand}</span> <Delta d={dec1.D} />.
      </li>
    );
  }

  return (
    <div className="text-sm text-gray-700 leading-6">
      {/* 읽는 법 배너 */}
      <div className="mb-2 flex items-center gap-2 text-[12px] text-slate-600">
        <Pill tone="slate">읽는 법</Pill>
        <span>
          <span className="font-semibold">X축=A(누적)</span>, <span className="font-semibold">Y축=Δ(이번 주 증가)</span> 입니다
          {periodLabel ? ` · ${periodLabel}` : ''}.
        </span>
      </div>

      {/* 하이라이트 라벨 */}
      {(inc1 || established) && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Pill tone="emerald">요즘 뜨는 브랜드</Pill>
          <span className="font-bold text-slate-900">{inc1?.brand ?? '—'}</span>
          <span className="mx-1 text-slate-300">·</span>
          <Pill tone="indigo">전통 강자</Pill>
          <span className="font-bold text-slate-900">{established?.brand ?? '—'}</span>
        </div>
      )}

      {/* 불릿 요약 */}
      <ul className="list-disc pl-5 space-y-1">
        {bullets.slice(0, maxLines)}
      </ul>
    </div>
  );
}
