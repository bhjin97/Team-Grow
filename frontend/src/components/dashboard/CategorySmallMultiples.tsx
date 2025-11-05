'use client';

import * as React from 'react';

// 간단 숫자 포맷
const fmt = (n: number) => n.toLocaleString();

// 카테고리별 색상(팔레트)
const COLORS = ['#7c3aed', '#ec4899', '#06b6d4', '#f59e0b'];

type CategoryPoint = {
  date: string;                 // 'YYYY-MM-DD'
  [cat: string]: any;           // { sum:number, index:number }
};

type Props = {
  series: CategoryPoint[];
  categories: string[];
  hoveredDate: string | null;
  onHover: (d: string | null) => void;

  // 옵션
  yScaleMode?: 'auto' | 'shared' | 'symlog';
  padFrac?: number;   // y패딩 비율
  minSpan?: number;   // 최소 y범위
  useIndex?: boolean; // sum 대신 index사용

  // ▶ 네비게이터(슬라이더) 표시 여부 (기본 false)
  showNavigator?: boolean;
};

function useContainerWidth<T extends HTMLElement>(min = 320, max = 1024) {
  const ref = React.useRef<T | null>(null);
  const [w, setW] = React.useState<number>(min);
  React.useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const resize = () => {
      const cw = el.clientWidth;
      setW(Math.max(min, Math.min(max, cw || min)));
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(el);
    return () => obs.disconnect();
  }, [min, max]);
  return { ref, width: w };
}

export default function CategorySmallMultiples({
  series,
  categories,
  hoveredDate,
  onHover,
  yScaleMode = 'auto',
  padFrac = 0.12,
  minSpan = 60,
  useIndex = false,
  showNavigator = false, // ← 기본 끔
}: Props) {
  // 날짜 오름차순
  const rows = React.useMemo(
    () => [...series].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [series]
  );

  // 공통 y도메인(공유 스케일이 필요한 경우)
  const sharedDomain = React.useMemo(() => {
    if (rows.length === 0) return null;
    let mn = Number.POSITIVE_INFINITY;
    let mx = Number.NEGATIVE_INFINITY;
    for (const c of categories) {
      for (const r of rows) {
        const raw = Number(r[c]?.[useIndex ? 'index' : 'sum'] ?? 0);
        mn = Math.min(mn, raw);
        mx = Math.max(mx, raw);
      }
    }
    if (!isFinite(mn) || !isFinite(mx)) return null;
    if (mx <= mn) mx = mn + 1;
    const span = mx - mn;
    const pad = Math.max(span * padFrac, minSpan - span, 1);
    return { min: Math.max(0, mn - pad), max: mx + pad };
  }, [rows, categories, yScaleMode, padFrac, minSpan, useIndex]);

  return (
    <div className="space-y-3">
      {/* 네비게이터는 기본 비활성 */}
      {showNavigator && (
        <div className="rounded-2xl border border-gray-200 p-3">
          <input type="range" min={0} max={rows.length - 1} className="w-full" />
        </div>
      )}

      <SmallMultiplesGrid
        rows={rows}
        categories={categories}
        hoveredDate={hoveredDate}
        onHover={onHover}
        sharedDomain={yScaleMode === 'shared' ? sharedDomain : null}
        useIndex={useIndex}
      />
    </div>
  );
}

function SmallMultiplesGrid({
  rows,
  categories,
  hoveredDate,
  onHover,
  sharedDomain,
  useIndex,
}: {
  rows: CategoryPoint[];
  categories: string[];
  hoveredDate: string | null;
  onHover: (d: string | null) => void;
  sharedDomain: { min: number; max: number } | null;
  useIndex: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {categories.map((c, i) => (
        <OneChart
          key={c}
          title={c}
          color={COLORS[i % COLORS.length]}
          points={rows.map(r => ({
            x: r.date,
            y: Number(r[c]?.[useIndex ? 'index' : 'sum'] ?? 0),
          }))}
          hoveredDate={hoveredDate}
          onHover={onHover}
          sharedDomain={sharedDomain}
        />
      ))}
    </div>
  );
}

function OneChart({
  title,
  color,
  points,
  hoveredDate,
  onHover,
  sharedDomain,
}: {
  title: string;
  color: string;
  points: { x: string; y: number }[];
  hoveredDate: string | null;
  onHover: (d: string | null) => void;
  sharedDomain: { min: number; max: number } | null;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>(320, 800);
  const height = 160;
  const pad = 26;

  const domain = React.useMemo(() => {
    if (sharedDomain) return sharedDomain;
    let mn = Number.POSITIVE_INFINITY;
    let mx = Number.NEGATIVE_INFINITY;
    for (const p of points) {
      mn = Math.min(mn, p.y);
      mx = Math.max(mx, p.y);
    }
    if (!isFinite(mn) || !isFinite(mx)) return { min: 0, max: 1 };
    if (mx <= mn) mx = mn + 1;
    const span = mx - mn;
    const pad = Math.max(span * 0.12, 60 - span, 1);
    return { min: Math.max(0, mn - pad), max: mx + pad };
  }, [points, sharedDomain]);

  const xs = (idx: number) =>
    pad + (points.length <= 1 ? 0 : (idx / (points.length - 1)) * (width - pad * 2));
  const ys = (v: number) =>
    height - pad - ((v - domain.min) / (domain.max - domain.min)) * (height - pad * 2);

  const path = React.useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, i) => `${i ? 'L' : 'M'} ${xs(i)} ${ys(p.y)}`).join(' ');
  }, [points, width, domain.min, domain.max]);

  const hoverX = React.useMemo(() => {
    if (!hoveredDate) return null;
    const i = points.findIndex(p => p.x === hoveredDate);
    return i >= 0 ? xs(i) : null;
  }, [hoveredDate, points, width]);

  const minVal = Math.round(Math.min(...points.map(p => p.y)));
  const maxVal = Math.round(Math.max(...points.map(p => p.y)));

  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">min {fmt(minVal)} · max {fmt(maxVal)}</div>
      </div>
      <div ref={ref} className="w-full">
        <svg width={width} height={height} className="block">
          {/* axes */}
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e5e7eb" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#e5e7eb" />

          {/* grid */}
          {[0.25, 0.5, 0.75].map(t => {
            const gy = pad + t * (height - pad * 2);
            const gx = pad + t * (width - pad * 2);
            return (
              <g key={t}>
                <line x1={pad} y1={gy} x2={width - pad} y2={gy} stroke="#f3f4f6" />
                <line x1={gx} y1={pad} x2={gx} y2={height - pad} stroke="#f3f4f6" />
              </g>
            );
          })}

          {/* line */}
          <path d={path} fill="none" stroke={color} strokeWidth={2} />

          {/* points */}
          {points.map((p, i) => (
            <circle key={p.x} cx={xs(i)} cy={ys(p.y)} r={2.5} fill={color}>
              <title>{`${p.x}\n${fmt(p.y)}`}</title>
            </circle>
          ))}

          {/* hover guide */}
          {hoverX !== null && (
            <g>
              <line x1={hoverX} y1={pad} x2={hoverX} y2={height - pad} stroke="#d1d5db" />
              <rect x={hoverX - 28} y={pad - 18} width={56} height={16} rx={4} fill="white" stroke="#e5e7eb" />
              <text x={hoverX} y={pad - 6} textAnchor="middle" fontSize="10" fill="#374151">
                {hoveredDate}
              </text>
            </g>
          )}

          {/* hover zones */}
          {points.map((p, i) => (
            <rect
              key={`hz-${p.x}`}
              x={i === 0 ? pad : (xs(i - 1) + xs(i)) / 2}
              y={pad}
              width={
                i === 0
                  ? (xs(0) + xs(1)) / 2 - pad
                  : i === points.length - 1
                  ? width - pad - (xs(i - 1) + xs(i)) / 2
                  : (xs(i + 1) - xs(i - 1)) / 2
              }
              height={height - pad * 2}
              fill="transparent"
              onMouseEnter={() => onHover(p.x)}
              onMouseLeave={() => onHover(null)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
