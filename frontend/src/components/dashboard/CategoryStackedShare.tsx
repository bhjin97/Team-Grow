'use client';

import * as React from 'react';

type CategoryPoint = {
  date: string;
  [cat: string]: any; // 각 카테고리 키에 { sum:number, index:number }
};

export default function CategoryStackedShare({
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
  // 가시성: 최근 → 과거 순 정렬이 들어올 수도 있으니 안전하게 날짜 오름차순
  const rows = React.useMemo(() => {
    return [...series].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [series]);

  // 색상 팔레트(단정/차분)
  const COLORS = ['#9b87f5', '#f5a2c0', '#8bd3dd', '#f6c667', '#94a3b8', '#34d399', '#fb7185'];

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-gray-900">주차별 카테고리 비중 (100% 스택 가로바)</div>
      <div className="text-xs text-gray-500 -mt-1">막대를 호버하면 해당 주차가 동기 하이라이트됩니다.</div>

      <div className="space-y-2">
        {/* 범례 */}
        <div className="flex flex-wrap gap-3 text-xs">
          {categories.map((c, i) => (
            <div key={c} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-gray-600">{c}</span>
            </div>
          ))}
        </div>

        {/* 차트 */}
        <div className="space-y-1.5">
          {rows.map((row) => {
            const totals = categories.map((c) => Number(row[c]?.sum ?? 0));
            const total = totals.reduce((a, b) => a + b, 0);
            let acc = 0;
            return (
              <div
                key={row.date}
                className={`rounded-lg border p-2 transition-colors ${
                  hoveredDate === row.date ? 'border-purple-300 bg-purple-50/40' : 'border-gray-200 bg-white'
                }`}
                onMouseEnter={() => onHover(row.date)}
                onMouseLeave={() => onHover(null)}
              >
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="font-medium text-gray-800">{row.date}</div>
                  <div className="text-gray-500">총합 {total.toLocaleString()}</div>
                </div>

                <div className="h-7 w-full rounded overflow-hidden bg-gray-100 relative">
                  {categories.map((c, i) => {
                    const v = Number(row[c]?.sum ?? 0);
                    const share = total > 0 ? v / total : 0;
                    const left = acc;
                    acc += share;
                    return (
                      <div
                        key={c}
                        title={`${c}: ${(share * 100).toFixed(1)}% (${v.toLocaleString()})`}
                        className="absolute top-0 bottom-0"
                        style={{
                          left: `${left * 100}%`,
                          width: `${share * 100}%`,
                          background: COLORS[i % COLORS.length],
                          opacity: hoveredDate && hoveredDate !== row.date ? 0.7 : 1,
                        }}
                      />
                    );
                  })}
                </div>

                {/* 각 세그먼트 라벨(>=8%만) */}
                <div className="mt-1 flex justify-between text-[11px] text-gray-600">
                  {categories.map((c, i) => {
                    const v = Number(row[c]?.sum ?? 0);
                    const share = total > 0 ? (v / total) * 100 : 0;
                    return (
                      <div key={c} className="min-w-[60px] text-center">
                        {share >= 8 ? (
                          <span>
                            <span className="font-medium" style={{ color: COLORS[i % COLORS.length] }}>
                              {c}
                            </span>{' '}
                            {share.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-400"> </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
