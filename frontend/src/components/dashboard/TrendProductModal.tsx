'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine
} from 'recharts';

type SeriesPoint = { date: string; count: number; index: number };
type ApiResp = {
  product: {
    pid: number; product_name: string; brand: string;
    image_url?: string | null; product_url?: string | null;
    price_krw?: number | null; category?: string | null;
  };
  series: SeriesPoint[];
  latest: {
    a_date: string; b_date: string;
    a_count: number; b_count: number;
    delta: number; pct: number; index: number;
  };
};

function kfmt(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n/1_000).toFixed(1)}k`;
  return `${n}`;
}
function pfmt(p: number): string {
  const s = (Math.round(p * 10) / 10).toFixed(1);
  return `${s}%`;
}
function dateMMDD(d: string) {
  const t = new Date(d);
  const m = `${t.getMonth()+1}`.padStart(2,'0');
  const day = `${t.getDate()}`.padStart(2,'0');
  return `${m}.${day}`;
}

interface Props {
  pid: number;
  open: boolean;
  onClose: () => void;
  apiBase: string; // e.g. API_BASE
}

export default function ProductTrendModal({ pid, open, onClose, apiBase }: Props) {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErr(null);
    fetch(`${apiBase}/api/trends/product_timeseries?pid=${pid}&weeks=12`)
      .then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j?.detail || 'load failed')))
      .then(setData)
      .catch(e => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [open, pid, apiBase]);

  // ── delta(주간 증감) 시리즈 생성
  const deltaSeries = useMemo(() => {
    if (!data?.series?.length) return [];
    const arr = data.series.map((p, i) => {
      const prev = i === 0 ? p.count : data.series[i-1].count;
      return { date: p.date, delta: p.count - prev };
    });
    // 첫 주는 0 으로 표기(비교 대상 없음)
    if (arr.length) arr[0].delta = 0;
    return arr;
  }, [data]);

  // 인덱스 라인 자동 줌(±여유)
  const indexDomain = useMemo(() => {
    if (!data?.series?.length) return [95, 105] as [number, number];
    const vals = data.series.map(s => s.index);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    if (mn === mx) {
      // 평평하면 약간 확대(사용자가 변화를 ‘느끼게’)
      return [mn - 3, mx + 3] as [number, number];
    }
    const pad = Math.max(2, (mx - mn) * 0.2);
    return [Math.floor(mn - pad), Math.ceil(mx + pad)] as [number, number];
  }, [data]);

  // delta 축 대칭
  const deltaDomain = useMemo(() => {
    const vals = deltaSeries.map(d => Math.abs(d.delta));
    const mx = vals.length ? Math.max(...vals) : 0;
    const pad = Math.max(10, mx * 0.15);
    return [-(mx + pad), (mx + pad)] as [number, number];
  }, [deltaSeries]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="p-4 sm:p-5 border-b flex items-center gap-3">
          {data?.product?.image_url ? (
            <img src={data.product.image_url} alt="" className="w-10 h-10 rounded object-cover" />
          ) : <div className="w-10 h-10 rounded bg-gray-100" />}
          <div className="flex-1">
            <div className="text-sm text-gray-500">{data?.product?.brand} · {data?.product?.category}</div>
            <div className="font-semibold">{data?.product?.product_name ?? '제품 상세'}</div>
            {data?.latest && (
              <div className="text-xs text-gray-500">
                A={data.latest.a_date} → B={data.latest.b_date}
              </div>
            )}
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-sm">닫기</button>
        </div>

        {/* KPI */}
        <div className="p-4 sm:p-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border p-4">
            <div className="text-xs text-gray-500">이번 주 리뷰 수</div>
            <div className="text-2xl font-bold">{data ? kfmt(data.latest.b_count) : '-'}</div>
            <div className="text-[11px] text-gray-500">B 기준(최신)</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs text-gray-500">증가 수(지난 주 대비)</div>
            <div className={`text-2xl font-bold ${ (data?.latest?.delta ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {(data && data.latest.delta >= 0 ? '▲ ' : '▼ ') + kfmt(Math.abs(data?.latest?.delta ?? 0))}
            </div>
            <div className="text-[11px] text-gray-500">양수면 상승, 음수면 감소</div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-xs text-gray-500">증가율(지수)</div>
            <div className="flex items-baseline gap-2">
              <div className={`text-2xl font-bold ${ (data?.latest?.pct ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {(data && data.latest.pct >= 0 ? '▲ ' : '▼ ') + pfmt(Math.abs(data?.latest?.pct ?? 0))}
              </div>
              <span className="text-xs text-gray-500">지수 {data?.latest?.index ?? 100}</span>
            </div>
            <div className="text-[11px] text-gray-500">A=100 기준 상대 변화</div>
          </div>
        </div>

        {/* 차트들 */}
        <div className="px-4 sm:px-6 pb-6 grid grid-cols-1 gap-6">
          {/* 인덱스(=100) 라인 — 자동줌 */}
          <div className="rounded-xl border">
            <div className="px-4 pt-3 text-sm font-medium">지수(=100, A 대비)</div>
            <div className="h-52 sm:h-60 px-2 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.series ?? []} margin={{ top: 10, right: 12, left: 8, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={dateMMDD}
                    minTickGap={24}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    domain={indexDomain}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}`}
                  />
                  <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="4 4" />
                  <Tooltip
                    formatter={(val:any, name:any) => [typeof val === 'number' ? val.toFixed(1) : val, '지수']}
                    labelFormatter={(label) => `${label} (A=100)`}
                  />
                  <Line type="monotone" dataKey="index" stroke="#2563eb" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="px-4 pb-3 text-[11px] text-gray-500">인덱스 100은 지난 기간과 같음을 뜻해요. 103은 약 3% 상승입니다.</div>
          </div>

          {/* Δ 증감(±) 바 — 0대칭 / 색상 양·음 */}
          <div className="rounded-xl border">
            <div className="px-4 pt-3 text-sm font-medium">리뷰 증감(지난 주 대비)</div>
            <div className="h-56 px-2 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deltaSeries} margin={{ top: 10, right: 12, left: 8, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={dateMMDD}
                    minTickGap={24}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    domain={deltaDomain}
                    tickFormatter={(v) => kfmt(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <ReferenceLine y={0} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(val:any) => [kfmt(Number(val)), '증감']}
                    labelFormatter={(label) => `${label} (지난 주 대비)`}
                  />
                  <Bar
                    dataKey="delta"
                    radius={[4,4,0,0]}
                    // 양수=청록, 음수=로즈
                    fill="#10b981"
                    shape={(props: any) => {
                      const { x, y, width, height, payload } = props;
                      const color = payload.delta >= 0 ? '#10b981' : '#ef4444';
                      const r = 4;
                      // 아래/위 방향에 따라 radius 다르게
                      if (height >= 0) {
                        return <rect x={x} y={y} width={width} height={height} rx={r} ry={r} fill={color} />;
                      } else {
                        return <rect x={x} y={y+height} width={width} height={-height} rx={r} ry={r} fill={color} />;
                      }
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="px-4 pb-3 text-[11px] text-gray-500">
              막대는 **절대 증가/감소**를, 위 라인은 0 기준으로 보정했습니다.
            </div>
          </div>
        </div>

        {/* 바닥 액션 */}
        <div className="px-4 sm:px-6 py-4 border-t flex items-center justify-between">
          {data?.product?.product_url ? (
            <a
              href={data.product.product_url}
              target="_blank"
              className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              상품 페이지 열기
            </a>
          ) : <div />}
          <div className="text-xs text-gray-500">
            인덱스 100은 A주와 같음을 의미합니다. 103은 약 3% 상승입니다.
          </div>
        </div>
      </div>

      {/* 로딩/에러 작은 토스트 */}
      {loading && <div className="absolute bottom-4 text-white text-sm">불러오는 중…</div>}
      {err && <div className="absolute bottom-4 px-2 py-1 bg-rose-600 text-white rounded text-sm">{err}</div>}
    </div>
  );
}
