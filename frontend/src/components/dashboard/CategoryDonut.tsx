'use client';
import * as React from 'react';
import { PALETTE_CATEGORY, fmtNumber } from '@/settings/trends';


type DonutProps = {
  title?: string;
  data: { label: string; value: number }[];
  size?: number; // px
  thickness?: number; // px
  hoveredLabel?: string | null; // 외부에서 hover 동기화(선택)
  onSliceHover?: (label: string | null) => void;
};

export default function CategoryDonut({
  title = '카테고리 비중',
  data,
  size = 240,
  thickness = 26,
  hoveredLabel,
  onSliceHover,
}: DonutProps) {
  const total = Math.max(1, data.reduce((s,d)=>s+(d.value||0),0));
  const radius = size/2;
  const inner = radius - thickness;

  let acc = 0;
  const arcs = data.map((d, i) => {
    const v = Math.max(0, d.value||0);
    const start = (acc/total) * 2*Math.PI;
    acc += v;
    const end = (acc/total) * 2*Math.PI;

    const largeArc = end - start > Math.PI ? 1 : 0;
    const x0 = radius + inner * Math.cos(start);
    const y0 = radius + inner * Math.sin(start);
    const x1 = radius + radius * Math.cos(start);
    const y1 = radius + radius * Math.sin(start);
    const x2 = radius + radius * Math.cos(end);
    const y2 = radius + radius * Math.sin(end);
    const x3 = radius + inner * Math.cos(end);
    const y3 = radius + inner * Math.sin(end);

    // donut sector path
    const dPath = [
      `M ${x0} ${y0}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${x0} ${y0}`,
      'Z'
    ].join(' ');

    const pct = ((v/total)*100).toFixed(1)+'%';
    const active = hoveredLabel===d.label;

    return {
      key: d.label,
      dPath,
      color: PALETTE_CATEGORY[i % PALETTE_CATEGORY.length],
      label: d.label,
      value: v,
      pct,
      active
    };
  });

  return (
    <div className="w-full">
      <div className="text-sm font-semibold text-gray-900 mb-3">{title}</div>
      <div className="flex flex-col items-center gap-4">
        <svg width={size} height={size} className="shrink-0 mx-auto block overflow-visible">
          {arcs.map((a) => (
            <path
              key={a.key}
              d={a.dPath}
              fill={a.color}
              opacity={a.active ? 1 : 0.9}
              stroke={a.active ? '#111827' : 'white'}
              strokeWidth={a.active ? 1.5 : 1}
              onMouseEnter={() => onSliceHover?.(a.label)}
              onMouseLeave={() => onSliceHover?.(null)}
            />
          ))}
          {/* 가운데 텍스트 */}
          <circle cx={radius} cy={radius} r={inner-1} fill="white" />
          <text x={radius} y={radius-4} textAnchor="middle" fontSize="12" fill="#6b7280">
            총합
          </text>
          <text x={radius} y={radius+12} textAnchor="middle" fontSize="14" fill="#111827" fontWeight={700}>
            {fmtNumber(total)}
          </text>
        </svg>

        {/* 범례: flex-wrap + 항목 폭 유연화 */}
        <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm leading-6">
          {arcs.map((a)=>(
            <div
              key={a.key}
              className={`
                flex items-center justify-between gap-2 px-2 py-0.5 rounded-md
                ${a.active ? 'font-semibold text-gray-900 bg-gray-50' : 'text-gray-700'}
                basis-1/2 md:basis-1/4 min-w-[200px] max-w-full
              `}
              onMouseEnter={() => onSliceHover?.(a.label)}
              onMouseLeave={() => onSliceHover?.(null)}
            >
              <span className="inline-block w-3 h-3 rounded shrink-0" style={{ background: a.color }} />
              <span className="flex-1 min-w-0 truncate">{a.label}</span>
              <span className="shrink-0 tabular-nums whitespace-nowrap">
                {fmtNumber(a.value)} ({a.pct})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
