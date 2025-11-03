'use client';

import * as React from 'react';

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
    const map: Record<string, { min: number; max: number }> = {};
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
      map[c] = { min: mi, max: ma };
    }
    return map;
  }, [rows, categories]);

  const COLORS = ['#9b87f5', '#f5a2c0', '#8bd3dd', '#f6c667', '#94a3b8', '#34d399', '#fb7185'];

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-900">카테고리별 절대량 추이 (스몰 멀티플 라인)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {categories.map((c, i) => (
          <SmallLine
            key={c}
            title={c}
            color={COLORS[i % COLORS.length]}
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
  domain: { min: number; max: number };
  hoveredDate: string | null;
  onHover: (d: string | null) => void;
}) {
  const width = 420;
  const height = 160;
  const pad = 28;

  const xs = (idx: number) =>
    pad + (points.length <= 1 ? 0 : (idx / (points.length - 1)) * (width - pad * 2));
  const ys = (v: number) =>
    height - pad - ((v - domain.min) / (domain.max - domain.min)) * (height - pad * 2);

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
          min {Math.round(domain.min).toLocaleString()} · max {Math.round(domain.max).toLocaleString()}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
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
            <circle key={p.x} cx={xs(i)} cy={ys(p.y)} r={2} fill={color}>
              <title>{`${p.x}\n${p.y.toLocaleString()}`}</title>
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
