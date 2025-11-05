'use client';

import * as React from 'react';
import { fmtNumber, fmtPercent } from '@/settings/trends';

export function CategoryDonutCaption({
  current,
  prev,
  weekLabel,
}: {
  current: { label: string; value: number }[];
  prev?:   { label: string; value: number }[];
  weekLabel: string;
}) {
  if (!current || current.length === 0) return null;
  const total = current.reduce((s, x) => s + (x.value || 0), 0) || 1;
  const sorted = [...current].sort((a,b)=> (b.value||0) - (a.value||0));
  const major = sorted[0];
  const majorShare = Math.round(((major.value||0)/total)*100);

  let deltaLine: string | null = null;
  if (prev && prev.length === current.length) {
    const prevTotal = prev.reduce((s, x) => s + (x.value || 0), 0) || 1;
    const byLabel = Object.fromEntries(current.map(d=>[d.label, d.value||0]));
    const byLabelPrev = Object.fromEntries(prev.map(d=>[d.label, d.value||0]));
    let upCat = ''; let upDiff = -Infinity;
    let downCat = ''; let downDiff = Infinity;
    for (const c of Object.keys(byLabel)) {
      const nowP = (byLabel[c]/total)*100;
      const prevP= ((byLabelPrev[c]||0)/prevTotal)*100;
      const diff = nowP - prevP;
      if (diff > upDiff) { upDiff = diff; upCat = c; }
      if (diff < downDiff){ downDiff = diff; downCat = c; }
    }
    deltaLine = `직전 주 대비 비중 변화: ${upCat} ${upDiff>=0?'+':''}${fmtPercent(upDiff)}p / ${downCat} ${fmtPercent(downDiff)}p`;
  }

  return (
    <div className="text-sm text-gray-700">
      <div>{weekLabel} 기준 비중입니다. <b>{major.label}</b>이 <b>{majorShare}%</b>로 가장 큽니다.</div>
      {deltaLine && <div className="text-gray-600">{deltaLine}</div>}
    </div>
  );
}

export function SmallMultiplesCaption({
  series,
  categories,
  window = 8,
}: {
  series: any[]; // { date, [cat]:{sum,index} }
  categories: string[];
  window?: number;
}) {
  if (!series?.length || !categories?.length) return null;
  const last = series.slice(-window);
  const stats = categories.map((c) => {
    const vals = last.map((r)=> Number(r[c]?.sum ?? 0));
    const diffs = vals.slice(1).map((v,i)=> v - vals[i]);
    const variance = diffs.reduce((s,v)=> s+v*v,0) / Math.max(1, diffs.length);
    const delta = (vals.at(-1) ?? 0) - (vals[0] ?? 0);
    return { cat: c, variance, delta };
  });
  const volatile = [...stats].sort((a,b)=> b.variance - a.variance)[0]?.cat;
  const rankInc = [...stats].sort((a,b)=> b.delta - a.delta).slice(0,2).map(x=>x.cat);
  const flat = [...stats].sort((a,b)=> Math.abs(a.delta) - Math.abs(b.delta))[0]?.cat;

  return (
    <div className="text-sm text-gray-700">
      <div>최근 {window}주 추이입니다. <b>{volatile ?? '—'}</b>가 변동성이 가장 크고, 증가 폭은 <b>{rankInc.join(', ') || '—'}</b>가 높습니다.</div>
      <div className="text-gray-600">보합에 가까운 카테고리: {flat ?? '—'}</div>
    </div>
  );
}

export function ABCompareCaption({
  aDate,
  bDate,
  top,
  bottom
}: {
  aDate: string; bDate: string;
  top?: { brand: string; delta: number; pct: number }[];
  bottom?: { brand: string; delta: number; pct: number }[];
}) {
  const t = top?.[0];
  const b = bottom?.[0];
  return (
    <div className="text-sm text-gray-700">
      <div>비교 기준: A={aDate} → B={bDate} (Δ = B−A)</div>
      {(t || b) && (
        <div className="text-gray-600">
          {t && <>증가 상위: <b>{t.brand}</b> (Δ {fmtNumber(t.delta)}, {t.pct>=0?'+':''}{t.pct.toFixed(1)}%)</>}
          {t && b && ' · '}
          {b && <>감소 상위: <b>{b.brand}</b> (Δ {fmtNumber(b.delta)}, {b.pct>=0?'+':''}{b.pct.toFixed(1)}%)</>}
        </div>
      )}
    </div>
  );
}