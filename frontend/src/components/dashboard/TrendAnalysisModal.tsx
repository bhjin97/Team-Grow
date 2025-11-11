'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../lib/env';
import { cn } from '../../lib/utils';
import ABCompareSection from './ABCompareSection';
import CategoryDonut from './CategoryDonut';

// ⬇︎ 새로 사용하는 모듈
import CategoryOverlay from './CategoryOverlay';
import OverlayCaption from './OverlayCaption';
import DonutDeltaCaption from './DonutDeltaCaption';
import BubbleCaption from './BubbleCaption';

type CategoryPoint = {
  date: string;
  [cat: string]: any; // { sum:number, index:number }
};

type CategoryTsResp = {
  series: CategoryPoint[];
  categories: string[];
};

type BrandItem = {
  brand: string;
  base_sum: number;
  current_sum: number;
  delta_sum: number;
};

type BrandResp = {
  meta: { category: string; a_date: string; b_date: string; min_base: number };
  items: BrandItem[];
};

type Props = {
  open: boolean;
  category: string;
  onClose: () => void;
  yScaleMode?: 'auto' | 'shared' | 'symlog';
  padFrac?: number;
  minSpan?: number;
  useIndex?: boolean;
};

const TabButton: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'px-3 py-1.5 rounded-lg text-sm font-medium',
      active ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'
    )}
  >
    {children}
  </button>
);

const Card: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className,
}) => (
  <div className={cn('bg-white rounded-xl border border-gray-200 p-4', className)}>
    <div className="text-sm font-semibold text-gray-900 mb-3">{title}</div>
    {children}
  </div>
);

const BarRow: React.FC<{
  label: string;
  value: number;
  max: number;
  sub?: string;
  pos?: boolean;
}> = ({ label, value, max, sub, pos }) => {
  const pct = max > 0 ? Math.min(100, Math.round((Math.abs(value) / max) * 100)) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 truncate">{label}</span>
        <span className={cn('font-semibold', pos ? 'text-emerald-700' : 'text-rose-700')}>
          {(pos ? '+' : '') + value.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded mt-1 overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: pos
              ? 'linear-gradient(90deg, #34d399 0%, #059669 100%)'
              : 'linear-gradient(90deg, #fca5a5 0%, #ef4444 100%)',
          }}
        />
      </div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
};

/** ─────────────────────────────────────────────────────────
 *  버블 차트 (브랜드 포지셔닝)
 *  - 호버 시 브랜드 라벨/요약 박스 표시
 *  ───────────────────────────────────────────────────────── */
const BubbleChart: React.FC<{ data: BrandItem[]; width?: number; height?: number }> = ({
  data,
  width = 980,
  height = 360,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const pad = 40;
  const maxA = Math.max(1, ...data.map((d) => d.base_sum));
  const minDelta = Math.min(0, ...data.map((d) => d.delta_sum));
  const maxDelta = Math.max(1, ...data.map((d) => d.delta_sum));
  const maxB = Math.max(1, ...data.map((d) => d.current_sum));

  const log1pSafe = (n: number) => Math.log1p(Math.max(0, n));
  const symlog = (n: number, c: number) => {
    const a = Math.abs(n);
    const linZone = c * 0.4;
    const scaled = a < linZone ? a / linZone : Math.log1p((a - linZone) / c) + 1;
    return Math.sign(n) * scaled;
  };

  const maxA_t = log1pSafe(maxA);
  const c = Math.max(1, Math.max(Math.abs(minDelta), Math.abs(maxDelta)) / 12);
  const minD_t = symlog(minDelta, c),
    maxD_t = symlog(maxDelta, c);

  const sx = (v: number) => pad + (log1pSafe(v) / maxA_t) * (width - pad * 2);
  const sy = (v: number) => {
    const t = symlog(v, c);
    return height - pad - ((t - minD_t) / (maxD_t - minD_t)) * (height - pad * 2);
  };
  const sr = (v: number) => 6 + Math.sqrt(v / Math.max(1, maxB)) * (24 - 6);

  const zeroY = sy(0);

  const points = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        x: sx(d.base_sum),
        y: sy(d.delta_sum),
        r: sr(d.current_sum),
      })),
    [data]
  );

  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="relative">
      <svg width={width} height={height} className="rounded-lg border border-gray-200 bg-white">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e5e7eb" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#e5e7eb" />
        <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="#eab308" strokeDasharray="4 4" />

        {points.map((p, i) => {
          const isHover = i === hoverIdx;
          return (
            <g
              key={p.brand}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                fill="rgba(155,135,245,0.25)"
                stroke="#9b87f5"
                strokeWidth={isHover ? 3 : 1.5}
              />
              {isHover && (
                <>
                  <rect
                    x={p.x - Math.min(80, Math.max(40, p.brand.length * 6)) / 2}
                    y={p.y - p.r - 22}
                    width={Math.min(80, Math.max(40, p.brand.length * 6))}
                    height={16}
                    rx={6}
                    fill="white"
                    stroke="#e5e7eb"
                  />
                  <text
                    x={p.x}
                    y={p.y - p.r - 10}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#374151"
                    style={{ pointerEvents: 'none' }}
                  >
                    {p.brand}
                  </text>
                </>
              )}
            </g>
          );
        })}

        <text x={width - pad} y={height - pad + 18} textAnchor="end" fontSize="11" fill="#6b7280">
          Base(A)
        </text>
        <text x={pad - 6} y={pad - 10} textAnchor="start" fontSize="11" fill="#6b7280">
          Δ(B−A)
        </text>
      </svg>

      {hovered && (
        <div
          className="absolute top-2 right-2 rounded-lg border border-gray-200 bg-white shadow px-3 py-2 text-xs"
          style={{ pointerEvents: 'none' }}
        >
          <div className="font-semibold text-gray-900 mb-0.5">{hovered.brand}</div>
          <div className="text-gray-700">
            A {hovered.base_sum.toLocaleString()} → B {hovered.current_sum.toLocaleString()}
          </div>
          <div className={cn('font-medium', hovered.delta_sum >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
            Δ {hovered.delta_sum.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default function TrendAnalysisModal({ open, category, onClose }: Props) {
  const [tab, setTab] = useState<'brand' | 'category' | 'ab'>('brand');
  const [brandData, setBrandData] = useState<BrandItem[] | null>(null);
  const [catTs, setCatTs] = useState<CategoryTsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [brandView, setBrandView] = useState<'list' | 'bubble'>('list');
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !category) return;
    let mounted = true;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const [brandRes, tsRes] = await Promise.all([
          fetch(`${API_BASE}/api/trends/brand_positioning?category=${encodeURIComponent(category)}`),
          // ✅ 썸네일과 동일한 정규화(avg) 타임시리즈 사용
          fetch(`${API_BASE}/api/trends/category_timeseries?normalize=avg`),
        ]);
        if (!brandRes.ok) throw new Error('brand_positioning 실패');
        if (!tsRes.ok) throw new Error('category_timeseries 실패');
        const brandJson: BrandResp = await brandRes.json();
        const tsJson: CategoryTsResp = await tsRes.json();
        if (!mounted) return;
        setBrandData(brandJson.items ?? []);
        setCatTs(tsJson ?? null);
      } catch {
        if (!mounted) return;
        setErr('분석 데이터를 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, category]);

  if (!open) return null;

  const byDeltaDesc = (brandData ?? []).slice().sort((a, b) => b.delta_sum - a.delta_sum);
  const byBDesc = (brandData ?? []).slice().sort((a, b) => b.current_sum - a.current_sum);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      <button aria-label="close overlay" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-[min(980px,92vw)] max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col h-full">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="text-lg font-bold text-gray-900">카테고리 분석</div>
            <div className="text-xs text-gray-500 mt-0.5">대상: {category}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 grid place-items-center text-gray-500"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-gray-200 sticky top-[64px] bg-white z-10">
          <div className="flex gap-2">
            <TabButton active={tab === 'brand'} onClick={() => setTab('brand')}>
              브랜드 분석
            </TabButton>
            <TabButton
              active={tab === 'category'}
              onClick={() => {
                setHoveredDate(null);
                setTab('category');
              }}
            >
              카테고리 추이
            </TabButton>
            <TabButton active={tab === 'ab'} onClick={() => setTab('ab')}>
              A/B 비교
            </TabButton>
          </div>
        </div>

        {/* Body */}
        <div id="trends-modal-body" className="p-5 overflow-y-auto flex-1 min-h-0">
          {loading && <div className="text-sm text-gray-500">불러오는 중…</div>}
          {!loading && err && <div className="text-sm text-rose-600">{err}</div>}

          {/* 브랜드 탭 */}
          {!loading && !err && tab === 'brand' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">정렬: 좌측은 증가 합계 TOP, 우측은 현재 규모 TOP</div>
                <button
                  type="button"
                  onClick={() => setBrandView((v) => (v === 'list' ? 'bubble' : 'list'))}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #b4a2f8 0%, #9b87f5 100%)' }}
                >
                  {brandView === 'list' ? '버블 차트 보기' : '리스트 보기'}
                </button>
              </div>

              {brandView === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card title="증가 합계 TOP (Δ)">
                    {!brandData?.length ? (
                      <div className="text-sm text-gray-500">데이터가 없습니다.</div>
                    ) : (
                      <div className="space-y-3">
                        {byDeltaDesc.slice(0, 8).map((b, i, arr) => (
                          <BarRow
                            key={`inc-${b.brand}-${i}`}
                            label={b.brand}
                            value={b.delta_sum}
                            max={Math.max(1, arr[0]?.delta_sum || 1)}
                            sub={`A: ${b.base_sum.toLocaleString()} → B: ${b.current_sum.toLocaleString()}`}
                            pos={b.delta_sum >= 0}
                          />
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card title="현재 규모 TOP (B 합계)">
                    {!brandData?.length ? (
                      <div className="text-sm text-gray-500">데이터가 없습니다.</div>
                    ) : (
                      <div className="space-y-3">
                        {byBDesc.slice(0, 8).map((b, i, arr) => (
                          <BarRow
                            key={`b-${b.brand}-${i}`}
                            label={b.brand}
                            value={b.current_sum}
                            max={Math.max(1, arr[0]?.current_sum || 1)}
                            sub={`Δ ${(b.current_sum - b.base_sum).toLocaleString()} / 지수 ${
                              b.base_sum > 0 ? ((b.current_sum / b.base_sum) * 100).toFixed(1) : '—'
                            }`}
                            pos={true}
                          />
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              ) : (
                <Card title="브랜드 포지셔닝(버블)">
                  {!brandData || brandData.length === 0 ? (
                    <div className="text-sm text-gray-500">데이터가 없습니다.</div>
                  ) : (
                    <>
                      <BubbleChart data={brandData.slice(0, 50)} />
                      <div className="mt-3">
                        <BubbleCaption data={brandData.slice(0, 200)} />
                      </div>
                    </>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* 카테고리 탭 */}
          {!loading && !err && tab === 'category' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* (좌) 도넛 + Δ비중 캡션 — 전략 A: 직전주 없으면 비교하지 않음 */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 min-w-0">
                {(() => {
                  const lastRow = catTs?.series?.[catTs.series.length - 1];
                  const row = catTs?.series?.find((r: any) => r.date === hoveredDate) ?? lastRow;

                  // 현재 주 기준의 직전/직전-1주 찾기
                  const { prevSource, prevPrevSource } = (() => {
                    if (!catTs || !row) return { prevSource: null as any, prevPrevSource: null as any };
                    const idx = catTs.series.findIndex((r) => r.date === row.date);
                    return {
                      prevSource: idx > 0 ? catTs.series[idx - 1] : null,
                      prevPrevSource: idx > 1 ? catTs.series[idx - 2] : null,
                    };
                  })();

                  // Δ 비중 데이터(현재 주 Δ)
                  // ▶ 전략 A: 직전주가 없으면 비교하지 않음 → 빈 배열
                  const donutData =
                    row && catTs && prevSource
                      ? catTs.categories.map((c) => {
                          const cur = Number(row[c]?.sum ?? 0);
                          const prev = Number(prevSource?.[c]?.sum ?? 0);
                          const delta = Math.max(0, cur - prev);
                          return { label: c, value: delta };
                        })
                      : [];

                  // 직전 주 Δ (캡션 비교용) — 전주와 전전주가 모두 있을 때만 계산
                  const prevDonut =
                    prevSource && prevPrevSource && catTs
                      ? catTs.categories.map((c) => {
                          const cur = Number(prevSource[c]?.sum ?? 0);
                          const prev = Number(prevPrevSource[c]?.sum ?? 0);
                          const delta = Math.max(0, cur - prev);
                          return { label: c, value: delta };
                        })
                      : undefined;

                  return (
                    <>
                      <CategoryDonut
                        title={row ? `주차별 카테고리 Δ 비중 (${row.date})` : '카테고리 Δ 비중'}
                        data={donutData}
                        size={272}
                        thickness={28}
                        hoveredLabel={null}
                        onSliceHover={() => {}}
                      />
                      <div className="mt-3">
                        <DonutDeltaCaption current={donutData} prev={prevDonut} weekLabel={row?.date ?? ''} />
                        {!prevSource && (
                          <div className="text-xs text-gray-500 mt-1">전주 데이터가 없어 Δ 비교를 표시하지 않습니다.</div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>


              {/* (우) 합쳐 그린 라인 오버레이 + 캡션 */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 min-w-0">
                <div className="text-sm font-semibold text-gray-900 mb-2">카테고리 비교</div>
                {catTs?.series?.length ? (
                  <>
                    <CategoryOverlay
                      series={catTs.series}
                      categories={catTs.categories}
                      hoveredDate={hoveredDate}
                      onHover={setHoveredDate}
                      // ✅ 썸네일과 동일: 베이스 대비 누적 증가선
                      plotMode="cumDelta"
                      padFrac={0.15}
                      minSpan={80}
                    />
                    <div className="mt-3">
                      <OverlayCaption series={catTs.series} categories={catTs.categories} window={8} />
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">데이터가 없습니다.</div>
                )}
              </div>
            </div>
          )}

          {/* A/B 비교 탭 */}
          {!loading && !err && tab === 'ab' && <ABCompareSection category={category} />}
        </div>
      </div>
    </div>
  );
}