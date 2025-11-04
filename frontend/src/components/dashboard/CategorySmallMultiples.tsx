'use client';

import * as React from 'react';
import { PALETTE_CATEGORY, fmtNumber, LOG_PAD_RATIO } from '@/settings/trends';

// === responsive width hook ===
function useContainerWidth<T extends HTMLElement>(min = 320, max = 640) {
  const ref = React.useRef<T | null>(null);
  const [w, setW] = React.useState<number>(max);
  React.useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver(() => {
      const cw = ref.current?.clientWidth ?? max;
      setW(Math.max(min, Math.min(max, cw)));
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [min, max]);
  return { ref, width: w };
}

// === scale helpers & toggle ===
const USE_LOG1P = true;
const log1p = (n: number) => Math.log1p(Math.max(0, n));
const expm1 = (n: number) => Math.expm1(n);

type CategoryPoint = {
  date: string;
  [cat: string]: any; // { sum:number, index:number }
};

export default function CategorySmallMultiples({
  series,
  categories,
  hoveredDate,
  onHover,
}: {
  series: CategoryPoint[];
  categories: string[];
  hoveredDate: string | null;
  onHover: (d: string | null) => void;
}) {
  const rows = React.useMemo(() => {
    return [...series].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [series]);

  // 각 카테고리별로 y-범위 계산(절대량 sum 기준)
    const yDomains = React.useMemo(() => {
      const map: Record<string, { min: number; max: number; displayMin: number; displayMax: number }> = {};
      for (const c of categories) {
        let mi = Number.POSITIVE_INFINITY;
        let ma = 0;
        for (const r of rows) {
          const v = Number(r[c]?.sum ?? 0);
          mi = Math.min(mi, v);
          ma = Math.max(ma, v);
        }
        if (!isFinite(mi)) mi = 0;
        if (ma <= mi) ma = mi + 1;

        // ① 표시용(원값) min/max
        const dispMin = mi;
        const dispMax = ma;

        // ② 스케일용 min/max (log1p or linear)
        const tMin = USE_LOG1P ? log1p(mi) : mi;
        const tMax = USE_LOG1P ? log1p(ma) : ma;

        // ③ 패딩(변환 공간에서 8% 또는 최소 1 단위)
        const gap = Math.max(1e-6, tMax - tMin);
        const padV = Math.max(gap * LOG_PAD_RATIO, 1);

        const outMin = USE_LOG1P ? Math.max(0, tMin - padV) : Math.max(0, tMin - padV);
        const outMax = USE_LOG1P ? (tMax + padV) : (tMax + padV);

        map[c] = { min: outMin, max: outMax, displayMin: dispMin, displayMax: dispMax };
      }
      return map;
    }, [rows, categories]);

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-900">카테고리별 절대량 추이 (스몰 멀티플 라인)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {categories.map((c, i) => (
          <SmallLine
            key={c}
            title={c}
            color={PALETTE_CATEGORY[i % PALETTE_CATEGORY.length]}
            points={rows.map((r) => ({ x: r.date, y: Number(r[c]?.sum ?? 0) }))}
            domain={yDomains[c]}
            hoveredDate={hoveredDate}
            onHover={onHover}
          />
        ))}
      </div>
    </div>
  );
}

function SmallLine({
  title,
  color,
  points,
  domain,
  hoveredDate,
  onHover,
}: {
  title: string;
  color: string;
  points: { x: string; y: number }[];
  domain: { min: number; max: number; displayMin: number; displayMax: number };
  hoveredDate: string | null;
  onHover: (d: string | null) => void;
}) {
  const { ref, width } = useContainerWidth<HTMLDivElement>(320, 640); // 부모 폭 추적
  const height = 160;
  const pad = 26;

  const xs = (idx: number) =>
    pad + (points.length <= 1 ? 0 : (idx / (points.length - 1)) * (width - pad * 2));
  const ys = (v: number) => {
    const tv = USE_LOG1P ? log1p(v) : v;
    return height - pad - ((tv - domain.min) / (domain.max - domain.min)) * (height - pad * 2);
  };


  // 라인 path
  const path = React.useMemo(() => {
    if (points.length === 0) return '';
    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xs(i)} ${ys(p.y)}`)
      .join(' ');
    return d;
  }, [points]);

  // hover guide x
  const hoverX = React.useMemo(() => {
    if (!hoveredDate) return null;
    const idx = points.findIndex((p) => p.x === hoveredDate);
    if (idx < 0) return null;
    return xs(idx);
  }, [hoveredDate, points]);

  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">
          min {fmtNumber(Math.round(domain.displayMin))} · max {fmtNumber(Math.round(domain.displayMax))}
        </div>
      </div>

      <div className="w-full overflow-x-auto" ref={ref}>
        <svg width={width} height={height} className="block">
          {/* Axes */}
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#e5e7eb" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#e5e7eb" />

          {/* grid */}
          {[0.25, 0.5, 0.75].map((t) => {
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
              <title>{`${p.x}\n${fmtNumber(p.y)}`}</title>
            </circle>
          ))} 

          {/* hover guide */}
          {hoverX !== null && (
            <g>
              <line x1={hoverX} y1={pad} x2={hoverX} y2={height - pad} stroke="#d1d5db" />
              <rect
                x={hoverX - 28}
                y={pad - 18}
                width={56}
                height={16}
                rx={4}
                fill="white"
                stroke="#e5e7eb"
              />
              <text
                x={hoverX}
                y={pad - 6}
                textAnchor="middle"
                fontSize="10"
                fill="#374151"
              >
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
