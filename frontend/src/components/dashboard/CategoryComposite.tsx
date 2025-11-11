'use client';

import * as React from 'react';
import { PALETTE_CATEGORY, fmtNumber } from '@/settings/trends';

type CategoryPoint = {
  date: string;
  // 각 카테고리 키에 { sum:number, index:number } 구조
  [cat: string]: any;
};

type Props = {
  series: CategoryPoint[];
  categories: string[];
  /** 기본 'index' 추천: 성장률 비교에 유리 */
  mode?: 'delta' | 'sum' | 'index';
  /** y축 스케일: shared(선형) | symlog(추천) */
  yScale?: 'shared' | 'symlog';
  /** 최근 몇 주만 그릴지 */
  window?: 8 | 12 | 20;
  className?: string;
};

const log1p = (v: number) => Math.log1p(Math.max(0, v));

// ✅ 기준 요일 판별(기본: 목요일=4)
const isAnchorDay = (dateStr: string, anchor = 4) => {
  // 'YYYY-MM-DD' 파싱 시 timezone 차이를 최소화하려고 안전 변환
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1)); // UTC 기준
  return dt.getUTCDay() === anchor; // 0=Sun .. 4=Thu
};

export default function CategoryComposite({
  series,
  categories,
  // ✅ 기본 모드를 'index'로 변경
  mode = 'index',
  yScale = 'symlog',
  window = 8,
  className,
}: Props) {
  const [active, setActive] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(categories.map(c => [c, true])) as Record<string, boolean>
  );
  const [curMode, setCurMode] = React.useState<'delta'|'sum'|'index'>(mode);
  const [win, setWin] = React.useState<8|12|20>(window);

  const rows = React.useMemo(() => {
    const arr = [...(series ?? [])].sort((a,b)=> a.date < b.date ? -1 : 1);
    return arr.slice(Math.max(0, arr.length - win));
  }, [series, win]);

  // ✅ 기준 주차(목요일)만 추출하여 x위치에 세로 보조선 표시
  const anchorIdxs = React.useMemo(() => {
    const idxs: number[] = [];
    rows.forEach((r, i) => {
      if (isAnchorDay(r.date, 4)) idxs.push(i);
    });
    return idxs;
  }, [rows]);

  // 카테고리별 points 계산
  const lines = React.useMemo(() => {
    const out: Record<string, {x:string; y:number; sum:number; idx:number; dlt:number}[]> = {};
    for (const c of categories) {
      const pts: {x:string; y:number; sum:number; idx:number; dlt:number}[] = [];
      let prevSum: number | null = null;
      for (const r of rows) {
        const sum = Number(r[c]?.sum ?? 0);
        const idx = Number(r[c]?.index ?? 100);
        const dlt = prevSum===null ? 0 : (sum - prevSum);
        prevSum = sum;
        let y = sum;
        if (curMode === 'index') y = idx;
        if (curMode === 'delta') y = dlt;
        pts.push({ x: r.date, y, sum, idx, dlt });
      }
      out[c] = pts;
    }
    return out;
  }, [rows, categories, curMode]);

  // y-domain (공유)
  const yDomain = React.useMemo(() => {
    let mi = Infinity, ma = -Infinity;
    for (const c of categories) {
      if (!active[c]) continue;
      for (const p of (lines[c] ?? [])) {
        mi = Math.min(mi, p.y);
        ma = Math.max(ma, p.y);
      }
    }
    if (!isFinite(mi) || !isFinite(ma)) { mi = 0; ma = 1; }
    if (mi === ma) ma = mi + 1;

    // symlog 변환 공간에서 살짝 패딩
    if (yScale === 'symlog') {
      const c = Math.max(1, Math.max(Math.abs(mi), Math.abs(ma)) / 12);
      const t = (v:number) => {
        const a = Math.abs(v);
        const lin = c * 0.4;
        const s = a < lin ? a/lin : Math.log1p((a-lin)/c)+1;
        return Math.sign(v)*s;
      };
      const tmi = t(mi), tma = t(ma);
      const pad = Math.max(0.5, (tma - tmi) * 0.08);
      return { mi, ma, tmi: tmi - pad, tma: tma + pad, c };
    }
    // linear
    const pad = Math.max(1, (ma - mi) * 0.08);
    return { mi: mi - pad, ma: ma + pad, tmi: mi - pad, tma: ma + pad, c: 0 };
  }, [lines, categories, active, yScale]);

  // 스케일 함수
  const size = { w: 320, h: 180, pad: 28 };
  const xs = (i:number) =>
    size.pad + (rows.length<=1 ? 0 : (i/(rows.length-1))*(size.w - size.pad*2));

  const sy = (v:number) => {
    if (yScale === 'symlog') {
      const { tmi, tma, c } = yDomain;
      const lin = c * 0.4;
      const t = (val:number) => {
        const a = Math.abs(val);
        const s = a < lin ? a/lin : Math.log1p((a-lin)/c)+1;
        return Math.sign(val)*s;
      };
      return size.h - size.pad - ((t(v)-tmi)/(tma-tmi))*(size.h - size.pad*2);
    }
    const { tmi, tma } = yDomain;
    return size.h - size.pad - ((v - tmi)/(tma - tmi))*(size.h - size.pad*2);
  };

  const colors = PALETTE_CATEGORY;

  return (
    <div className={className}>
      {/* 헤더/컨트롤 */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-gray-900">카테고리 비교 (복합 선그래프)</div>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={curMode}
            onChange={(e)=>setCurMode(e.target.value as any)}
            className="border rounded-md px-2 py-1"
            title="표시 지표"
          >
            <option value="delta">증가폭 Δ</option>
            <option value="sum">합계</option>
            <option value="index">지수(첫 주=100)</option>
          </select>
          <select
            value={win}
            onChange={(e)=>setWin(Number(e.target.value) as any)}
            className="border rounded-md px-2 py-1"
            title="최근 구간"
          >
            <option value={8}>최근 8주</option>
            <option value={12}>최근 12주</option>
            <option value={20}>최근 20주</option>
          </select>
        </div>
      </div>

      {/* 그래프 */}
      <div className="rounded-xl border border-gray-200 bg-white p-2">
        <svg width={size.w} height={size.h}>
          {/* ✅ 기준 주차(목요일) 세로 보조선: 텍스트 표기 없음 */}
          {anchorIdxs.map((i) => (
            <line
              key={`anchor-${i}`}
              x1={xs(i)} x2={xs(i)}
              y1={size.pad} y2={size.h - size.pad}
              stroke="#cbd5e1" /* slate-300 */
              strokeDasharray="3 3"
            />
          ))}

          {/* 축 */}
          <line x1={size.pad} y1={size.h - size.pad} x2={size.w - size.pad} y2={size.h - size.pad} stroke="#e5e7eb"/>
          <line x1={size.pad} y1={size.pad} x2={size.pad} y2={size.h - size.pad} stroke="#e5e7eb"/>

          {/* 0 기준선 (Δ일 때만) */}
          {curMode === 'delta' && (
            <line
              x1={size.pad} x2={size.w - size.pad}
              y1={sy(0)} y2={sy(0)}
              stroke="#f59e0b" strokeDasharray="4 4"
            />
          )}

          {/* 라인들 */}
          {categories.map((c, ci) => {
            if (!active[c]) return null;
            const pts = lines[c] ?? [];
            const d = pts.map((p,i)=> `${i===0?'M':'L'} ${xs(i)} ${sy(p.y)}`).join(' ');
            return (
              <g key={c}>
                <path d={d} fill="none" stroke={colors[ci % colors.length]} strokeWidth={2}/>
                {pts.map((p,i)=>(
                  <circle
                    key={`${c}-${p.x}`}
                    cx={xs(i)} cy={sy(p.y)} r={2.5}
                    fill={colors[ci % colors.length]}
                  >
                    <title>
                      {`${c}\n${p.x}\n${curMode==='delta'?'Δ ':''}${fmtNumber(p.y)}`}
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>

        {/* 범례 (클릭으로 토글) */}
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c, ci)=>(
            <button
              key={c}
              onClick={()=> setActive(a => ({...a, [c]: !a[c]}))}
              className={`px-2 py-1 rounded-md text-xs border ${
                active[c] ? 'bg-white' : 'bg-gray-100 opacity-60'
              }`}
              style={{ borderColor: '#e5e7eb', color: colors[ci % colors.length] }}
              title={c}
              type="button"
            >
              {active[c] ? '●' : '○'} {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
