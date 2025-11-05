'use client';

import * as React from 'react';

type CategoryPoint = {
  date: string;                 // 'YYYY-MM-DD'
  [cat: string]: any;           // { sum:number, index:number }
};

const COLORS = ['#7c3aed', '#ec4899', '#06b6d4', '#f59e0b'];
const fmt = (n: number) => n.toLocaleString();

function useContainerWidth<T extends HTMLElement>(min = 280, max = 1024) {
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

export default function CategoryOverlay({
  series,
  categories,
  hoveredDate,
  onHover,
  useIndex = false,
  padFrac = 0.12,
  minSpan = 60,
}: {
  series: CategoryPoint[];
  categories: string[];
  hoveredDate: string | null;
  onHover: (d: string | null) => void;
  useIndex?: boolean;
  padFrac?: number;
  minSpan?: number;
}) {
  // 날짜 오름차순
  const rows = React.useMemo(
    () => [...series].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [series]
  );

  // 공유 y-domain
  const { domain, lines } = React.useMemo(() => {
    if (rows.length === 0)
      return { domain: { min: 0, max: 1 }, lines: {} as Record<string, { x: string; y: number }[]> };
    let mn = Number.POSITIVE_INFINITY;
    let mx = Number.NEGATIVE_INFINITY;
    const map: Record<string, { x: string; y: number }[]> = {};
    for (const c of categories) {
      const pts = rows.map(r => {
        const y = Number(r[c]?.[useIndex ? 'index' : 'sum'] ?? 0);
        mn = Math.min(mn, y);
        mx = Math.max(mx, y);
        return { x: r.date, y };
      });
      map[c] = pts;
    }
    if (!isFinite(mn) || !isFinite(mx)) mn = 0, mx = 1;
    if (mx <= mn) mx = mn + 1;
    const span = mx - mn;
    const pad = Math.max(span * padFrac, minSpan - span, 1);
    return { domain: { min: Math.max(0, mn - pad), max: mx + pad }, lines: map };
  }, [rows, categories, useIndex, padFrac, minSpan]);

  // 차트 사이즈/패딩
  const { ref, width } = useContainerWidth<HTMLDivElement>(280, 900);
  const innerW = Math.floor(width); // px 깨짐 방지
  const height = 220;
  const pad = 28;

  const dates = rows.map(r => r.date);
  const xs = (idx: number) =>
    pad + (dates.length <= 1 ? 0 : (idx / (dates.length - 1)) * (innerW - pad * 2));
  const ys = (v: number) =>
    height - pad - ((v - domain.min) / (domain.max - domain.min)) * (height - pad * 2);

  const hoverX = React.useMemo(() => {
    if (!hoveredDate) return null;
    const i = dates.findIndex(d => d === hoveredDate);
    return i >= 0 ? xs(i) : null;
  }, [hoveredDate, dates, innerW]);

  // 범례 강조 토글
  const [active, setActive] = React.useState<string | null>(null);
  const toggle = (c: string) => setActive(prev => (prev === c ? null : c));

  return (
    <div className="space-y-2">
      {/* 범례 */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c, i) => {
          const on = !active || active === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className={`inline-flex items-center gap-2 rounded-lg border px-2 py-1 text-xs ${
                on ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
              title={on ? '클릭하면 이 카테고리만 강조' : '다시 클릭하면 모두 보기'}
            >
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {c}
            </button>
          );
        })}
      </div>

      {/* 차트: 오버플로 방지 래퍼 */}
      <div ref={ref} className="w-full overflow-hidden rounded-lg">
        <svg width={innerW} height={height} className="block">
          {/* axes */}
          <line x1={pad} y1={height - pad} x2={innerW - pad} y2={height - pad} stroke="#e5e7eb" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#e5e7eb" />
          {/* grid */}
          {[0.25, 0.5, 0.75].map(t => {
            const gy = pad + t * (height - pad * 2);
            const gx = pad + t * (innerW - pad * 2);
            return (
              <g key={t}>
                <line x1={pad} y1={gy} x2={innerW - pad} y2={gy} stroke="#f3f4f6" />
                <line x1={gx} y1={pad} x2={gx} y2={height - pad} stroke="#f3f4f6" />
              </g>
            );
          })}

          {/* 라인들 */}
          {categories.map((c, i) => {
            const pts = lines[c] || [];
            const path = pts.map((p, idx) => `${idx ? 'L' : 'M'} ${xs(idx)} ${ys(p.y)}`).join(' ');
            const on = !active || active === c;
            return (
              <g key={c} opacity={on ? 1 : 0.25}>
                <path d={path} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={2} />
                {pts.length > 0 && (
                  <circle cx={xs(pts.length - 1)} cy={ys(pts[pts.length - 1].y)} r={3} fill={COLORS[i % COLORS.length]} />
                )}
              </g>
            );
          })}

          {/* 호버 가이드 */}
          {hoverX !== null && (
            <g>
              <line x1={hoverX} y1={pad} x2={hoverX} y2={height - pad} stroke="#d1d5db" />
              <rect x={hoverX - 36} y={pad - 20} width={72} height={16} rx={4} fill="white" stroke="#e5e7eb" />
              <text x={hoverX} y={pad - 8} textAnchor="middle" fontSize="10" fill="#374151">
                {hoveredDate}
              </text>
            </g>
          )}

          {/* 호버 존 */}
          {dates.map((d, i) => (
            <rect
              key={`hz-${d}`}
              x={i === 0 ? pad : (xs(i - 1) + xs(i)) / 2}
              y={pad}
              width={
                i === 0
                  ? (xs(0) + xs(1)) / 2 - pad
                  : i === dates.length - 1
                  ? innerW - pad - (xs(i - 1) + xs(i)) / 2
                  : (xs(i + 1) - xs(i - 1)) / 2
              }
              height={height - pad * 2}
              fill="transparent"
              onMouseEnter={() => onHover(d)}
              onMouseLeave={() => onHover(null)}
            />
          ))}
        </svg>
      </div>

      {/* 마지막 주 값 요약 */}
      <div className="text-[11px] text-gray-500">
        {categories.map((c, i) => {
          const pts = (lines[c] || []);
          const last = pts[pts.length - 1];
          return (
            <span key={c} className="mr-3">
              <span className="inline-block w-2 h-2 rounded-sm mr-1" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {c}: {last ? fmt(Math.round(last.y)) : '—'}
            </span>
          );
        })}
      </div>
    </div>
  );
}

