'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../lib/env';
import { cn } from '../../lib/utils';
import ABCompareSection from './ABCompareSection';
import CategoryStackedShare from './CategoryStackedShare';
import CategorySmallMultiples from './CategorySmallMultiples';
import CategoryDonut from './CategoryDonut';

type CategoryPoint = {
  date: string;
  [cat: string]: any; // 각 카테고리 키에 { sum:number, index:number }
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
};

const TOP_LIST_LIMIT = 5; // ✅ 리스트는 5개만 노출

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

/** 막대(Bar) */
const BarRow: React.FC<{
  label: string;
  value: number;
  max: number;
  sub?: string;
}> = ({ label, value, max, sub }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-700 truncate">{label}</span>
        <span className="text-gray-900 font-semibold">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 w-full bg-gray-100 rounded mt-1 overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #b4a2f8 0%, #9b87f5 100%)',
          }}
        />
      </div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
};

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

/** 작은 2점 스파크라인(A->B) */
const Sparkline: React.FC<{
  a: number;
  b: number;
  width?: number;
  height?: number;
}> = ({ a, b, width = 120, height = 28 }) => {
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  const pad = 4;
  const range = Math.max(1, max - min);
  const yA = height - pad - ((a - min) / range) * (height - pad * 2);
  const yB = height - pad - ((b - min) / range) * (height - pad * 2);
  return (
    <svg width={width} height={height} className="block">
      <polyline
        points={`${pad},${yA} ${width - pad},${yB}`}
        fill="none"
        stroke="#9b87f5"
        strokeWidth="2"
      />
      <circle cx={pad} cy={yA} r="2" fill="#9b87f5" />
      <circle cx={width - pad} cy={yB} r="2" fill="#9b87f5" />
    </svg>
  );
};

/** 버블 차트 */
const BubbleChart: React.FC<{
  data: BrandItem[];
  width?: number;
  height?: number;
}> = ({ data, width = 980, height = 360 }) => {
  const pad = 40;

  // x축(A), y축(Δ) 범위
  const maxA = Math.max(1, ...data.map(d => d.base_sum));
  const minDelta = Math.min(0, ...data.map(d => d.delta_sum));
  const maxDelta = Math.max(1, ...data.map(d => d.delta_sum));
  const maxB = Math.max(1, ...data.map(d => d.current_sum));

  const sx = (v: number) => pad + (v / maxA) * (width - pad * 2);
  const sy = (v: number) => {
    const range = Math.max(1, maxDelta - minDelta);
    return height - pad - ((v - minDelta) / range) * (height - pad * 2);
  };
  const sr = (v: number) => 6 + (v / maxB) * 16;

  // 툴팁 상태
  const [tip, setTip] = React.useState<{ x: number; y: number; payload?: BrandItem | null }>({
    x: 0,
    y: 0,
    payload: null,
  });

  const zeroY = sy(0);
  const HIT_R = 18;

  const onMouseMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let best: { item: BrandItem; dist: number } | null = null;
    for (const d of data) {
      const px = sx(d.base_sum);
      const py = sy(d.delta_sum);
      const dist = Math.hypot(mx - px, my - py);
      if (!best || dist < best.dist) best = { item: d, dist };
    }
    if (best && best.dist <= HIT_R + 6) {
      setTip({ x: mx, y: my, payload: best.item });
    } else {
      setTip(prev => ({ ...prev, payload: null }));
    }
  };

  const onLeave = () => setTip(prev => ({ ...prev, payload: null }));

  // 유틸: 증감률 텍스트
  const pctText = (base: number, curr: number) => {
    const pct = base > 0 ? ((curr / base) - 1) * 100 : 0;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width={width}
        height={height}
        className="rounded-lg border border-gray-200 bg-white"
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={onMouseMove}
        onMouseLeave={onLeave}
      >
        {/* 축 */}
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e5e7eb" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#e5e7eb" />

        {/* 그리드 */}
        {[0.25, 0.5, 0.75].map((t) => {
          const gx = pad + t * (width - pad * 2);
          const gy = pad + t * (height - pad * 2);
          return (
            <g key={t}>
              <line x1={gx} y1={pad} x2={gx} y2={height - pad} stroke="#f3f4f6" />
              <line x1={pad} y1={gy} x2={width - pad} y2={gy} stroke="#f3f4f6" />
            </g>
          );
        })}

        {/* 라벨 */}
        <text x={width - pad} y={height - pad + 18} textAnchor="end" fontSize="11" fill="#6b7280">
          Base(A)
        </text>
        <text x={pad - 6} y={pad - 10} textAnchor="start" fontSize="11" fill="#6b7280">
          Δ(B−A)
        </text>

        {/* Δ=0 기준선 */}
        <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="#eab308" strokeDasharray="4 4" />
        <text x={pad + 6} y={zeroY - 6} fontSize="10" fill="#a16207">Δ=0</text>

        {/* 버블 */}
        {data.map((d) => {
          const x = sx(d.base_sum);
          const y = sy(d.delta_sum);
          const r = sr(d.current_sum);
          return (
            <g key={d.brand}>
              <circle cx={x} cy={y} r={r} fill="rgba(155,135,245,0.25)" stroke="#9b87f5" />
            </g>
          );
        })}

        {/* 툴팁 */}
        {tip.payload && (
          <g transform={`translate(${tip.x + 12}, ${tip.y - 12})`} pointerEvents="none">
            <rect x={0} y={-48} rx={6} ry={6} width={240} height={72} fill="white" stroke="#e5e7eb" />
            <text x={8} y={-30} fontSize="12" fill="#111827" fontWeight={600}>
              {tip.payload.brand}
            </text>
            <text x={8} y={-14} fontSize="11" fill="#4b5563">
              {`A: ${tip.payload.base_sum.toLocaleString()}   B: ${tip.payload.current_sum.toLocaleString()}`}
            </text>
            <text x={8} y={2} fontSize="11" fill={tip.payload.delta_sum >= 0 ? '#047857' : '#b91c1c'}>
              {`Δ: ${tip.payload.delta_sum.toLocaleString()}   ( ${pctText(tip.payload.base_sum, tip.payload.current_sum)} )`}
            </text>
          </g>
        )}
      </svg>
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

  // ✅ 모달 열렸을 때 바디 스크롤 잠금
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  useEffect(() => {
    if (!open || !category) return;
    let mounted = true;
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        const [brandRes, tsRes] = await Promise.all([
          fetch(`${API_BASE}/api/trends/brand_positioning?category=${encodeURIComponent(category)}`),
          fetch(`${API_BASE}/api/trends/category_timeseries`),
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

  // TOP4 (증가합계 기준)
  const top4ByDelta = useMemo(() => {
    if (!brandData) return [];
    return [...brandData].sort((a, b) => b.delta_sum - a.delta_sum).slice(0, 4);
  }, [brandData]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center">
      {/* Overlay */}
      <button
        aria-label="close overlay"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      {/* Modal Shell */}
      <div className="relative w-[min(980px,92vw)] max-h-[90vh] bg-white rounded-2xl shadow-xl flex flex-col h-full">
        {/* Header (sticky) */}
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

        {/* Tabs (sticky) */}
        <div className="px-5 pt-3 pb-2 border-b border-gray-200 sticky top-[64px] bg-white z-10">
          <div className="flex gap-2">
            <TabButton active={tab === 'brand'} onClick={() => setTab('brand')}>브랜드 분석</TabButton>
            <TabButton active={tab === 'category'} onClick={() => setTab('category')}>카테고리 추이</TabButton>
            <TabButton active={tab === 'ab'} onClick={() => setTab('ab')}>A/B 비교</TabButton>
          </div>
        </div>

        {/* Body (스크롤 영역) */}
        <div className="p-5 overflow-y-auto flex-1 min-h-0">
          {loading && <div className="text-sm text-gray-500">불러오는 중…</div>}
          {!loading && err && <div className="text-sm text-rose-600">{err}</div>}

          {/* 브랜드 탭 */}
          {!loading && !err && tab === 'brand' && (
            <div className="space-y-4">
              {/* TOP4 카드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {top4ByDelta.map((b) => {
                  const pct = b.base_sum > 0 ? (((b.current_sum / b.base_sum) - 1) * 100) : 0;
                  const pctLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
                  return (
                    <div key={b.brand} className="relative rounded-xl border border-gray-200 p-3 bg-white">
                      <div
                        className="absolute right-2 top-2 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
                      >
                        {pctLabel}
                      </div>

                      <div className="text-xs text-gray-500">브랜드</div>
                      <div className="text-sm font-semibold text-gray-900 truncate pr-14">{b.brand}</div>

                      <div className="mt-2 flex items-center justify-between text-xs">
                        <div className="text-gray-600">A {b.base_sum.toLocaleString()}</div>
                        <div className="font-semibold text-emerald-700">Δ {b.delta_sum.toLocaleString()}</div>
                        <div className="text-gray-900">B {b.current_sum.toLocaleString()}</div>
                      </div>
                      <div className="mt-2">
                        <Sparkline a={b.base_sum} b={b.current_sum} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 리스트/버블 전환 */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">정렬: 좌측은 증가 합계 TOP, 우측은 현재 규모 TOP</div>
                <button
                  type="button"
                  onClick={() => setBrandView(v => (v === 'list' ? 'bubble' : 'list'))}
                  className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #b4a2f8 0%, #9b87f5 100%)' }}
                >
                  {brandView === 'list' ? '버블 차트 보기' : '리스트 보기'}
                </button>
              </div>

              {brandView === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card title="증가 합계 TOP 브랜드">
                    {!brandData || brandData.length === 0 ? (
                      <div className="text-sm text-gray-500">데이터가 없습니다.</div>
                    ) : (
                      <div className="space-y-3">
                        {[...brandData]
                          .sort((a, b) => b.delta_sum - a.delta_sum)
                          .slice(0, TOP_LIST_LIMIT) 
                          .map((b, _, arr) => (
                            <BarRow
                              key={b.brand}
                              label={b.brand}
                              value={b.delta_sum}
                              max={(arr[0]?.delta_sum || 1)}
                              sub={`A: ${b.base_sum.toLocaleString()} → B: ${b.current_sum.toLocaleString()} (Δ ${b.delta_sum.toLocaleString()})`}
                            />
                          ))}
                      </div>
                    )}
                  </Card>

                  <Card title="현재 규모 TOP 브랜드 (B 합계)">
                    {!brandData || brandData.length === 0 ? (
                      <div className="text-sm text-gray-500">데이터가 없습니다.</div>
                    ) : (
                      <div className="space-y-3">
                        {[...brandData]
                          .sort((a, b) => b.current_sum - a.current_sum)
                          .slice(0, TOP_LIST_LIMIT) 
                          .map((b, _, arr) => (
                            <BarRow
                              key={b.brand}
                              label={b.brand}
                              value={b.current_sum}
                              max={(arr[0]?.current_sum || 1)}
                              sub={`A: ${b.base_sum.toLocaleString()} / Δ ${(b.current_sum - b.base_sum).toLocaleString()}`}
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
                    <BubbleChart data={brandData.slice(0, 50)} />
                  )}
                </Card>
              )}
            </div>
          )}

          {/* 카테고리 탭 */}
          {!loading && !err && tab === 'category' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">
                  4개 카테고리 주간 합계(지수=첫 주 100)
                </div>
                {!catTs || !catTs.series || catTs.series.length === 0 ? (
                  <div className="text-sm text-gray-500">데이터가 없습니다.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-sm">
                      <thead className="text-gray-500">
                        <tr>
                          <th className="text-left py-2 pr-3">주차</th>
                          {catTs.categories.map((c) => (
                            <th key={c} className="text-right py-2 px-3">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {catTs.series.map((row) => (
                          <tr
                            key={row.date}
                            className="border-t border-gray-100"
                            onMouseEnter={() => setHoveredDate(row.date)}
                            onMouseLeave={() => setHoveredDate(null)}
                          >
                            <td className="py-2 pr-3 text-gray-600">{row.date}</td>
                            {catTs.categories.map((c) => (
                              <td key={c} className="py-2 px-3 text-right">
                                <div className="text-gray-900">
                                  {row[c]?.sum?.toLocaleString?.() ?? 0}
                                </div>
                                <div className="text-xs text-gray-500">{row[c]?.index ?? 100} 지수</div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {catTs && catTs.series && catTs.series.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 좌: 도넛(선택 주의 카테고리 비중) */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        {(() => {
                        // hoveredDate 없으면 가장 최근 주 사용
                        const lastRow = catTs.series[catTs.series.length-1];
                        const row = catTs.series.find(r => r.date === hoveredDate) ?? lastRow;
                        const donutData = catTs.categories.map(c => ({
                            label: c,
                            value: Number(row[c]?.sum ?? 0)
                        }));
                        return (
                            <CategoryDonut
                            title={`주차별 카테고리 비중 (${row.date})`}
                            data={donutData}
                            hoveredLabel={null}
                            onSliceHover={() => {}}
                            />
                        );
                        })()}
                    </div>

                    {/* 우: 2×2 스몰멀티플 유지 */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <CategorySmallMultiples
                        series={catTs.series}
                        categories={catTs.categories}
                        hoveredDate={hoveredDate}
                        onHover={setHoveredDate}
                        />
                    </div>

                    {/* 추가: 100% 스택(share) 카드 — 두 번째 행 좌측 */}
                    <div className="bg-white rounded-xl border border-gray-200 p-4 lg:col-span-2">
                        <CategoryStackedShare
                        series={catTs.series}
                        categories={catTs.categories}
                        hoveredDate={hoveredDate}
                        onHover={setHoveredDate}
                        />
                    </div>
                    </div>

              )}
            </div>
          )}

          {/* A/B 비교 탭 */}
          {!loading && !err && tab === 'ab' && <ABCompareSection category={category} />}
        </div>

        {/* Footer (sticky-like: 모달 내부 하단에 고정) */}
        <div className="px-5 py-3 border-t border-gray-200 bg-white sticky bottom-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
