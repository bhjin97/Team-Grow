'use client';
import * as React from 'react';

type DonutProps = {
  title?: string;
  data: { label: string; value: number }[];
  size?: number; // px
  thickness?: number; // px
  hoveredLabel?: string | null; // 외부에서 hover 동기화(선택)
  onSliceHover?: (label: string | null) => void;
};

const COLORS = ['#9b87f5','#b4a2f8','#d1c4ff','#f5c6d9']; // 기존 톤 유지(연보라/핑크)

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
      color: COLORS[i % COLORS.length],
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
            {total.toLocaleString()}
          </text>
        </svg>

        {/* 범례 */}
        <div className="w-full grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {arcs.map((a)=>(
            <div
                key={a.key}
                className={`
                    flex items-center gap-2 text-sm
                    ${a.active ? 'font-semibold text-gray-900' : 'text-gray-700'}
                `}
                onMouseEnter={() => onSliceHover?.(a.label)}
                onMouseLeave={() => onSliceHover?.(null)}
                >
                <span className="inline-block w-3 h-3 rounded shrink-0" style={{ background: a.color }} />
                <span className="truncate max-w-[7rem]">{a.label}</span>
                <span className="ml-auto tabular-nums text-right whitespace-nowrap">{a.value.toLocaleString()} ({a.pct})</span>
                </div>

                        ))}
        </div>
      </div>
    </div>
  );
}
