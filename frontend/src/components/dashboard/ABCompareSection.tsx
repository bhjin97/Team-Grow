'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../lib/env';
import { cn } from '../../lib/utils'; // ← 이거만 사용, 로컬 cn 선언 금지!

type BrandItem = {
  brand: string;
  base_sum: number | null;     // 방어 위해 null 허용
  current_sum: number | null;  // 방어 위해 null 허용
  delta_sum: number | null;    // 방어 위해 null 허용
};

type BrandResp = {
  meta: { category: string; a_date: string; b_date: string; min_base: number };
  items: BrandItem[];
};

type LeaderboardItem = {
  pid: number;
  product_name: string;
  brand: string;
  image_url: string | null;
  product_url: string | null;
  price_krw: number | null;
  rag_text: string;
  a_count: number;
  b_count: number;
  delta: number;
  pct: number;
  index: number;
};

type LeaderboardResp = {
  meta: any;
  items: LeaderboardItem[];
};

/** 화면 잘림 방지: 리스트 노출 개수 & 요약 개수 */
const TOP_N = 5;
const BOTTOM_N = 5;
const SUMMARY_N = 7;

export default function ABCompareSection({ category }: { category: string }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [brands, setBrands] = useState<BrandItem[] | null>(null);
  const [repMap, setRepMap] = useState<Record<string, LeaderboardItem | undefined>>({}); // brand -> 대표 제품 1개

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        // 1) 브랜드 A/B 합계
        const brandRes = await fetch(
          `${API_BASE}/api/trends/brand_positioning?category=${encodeURIComponent(category)}`
        );
        if (!brandRes.ok) throw new Error('brand_positioning 실패');
        const brandJson: BrandResp = await brandRes.json();

        // 2) 대표 제품(리뷰 많은 순 상위 N → brand별 첫 1개)
        const lbRes = await fetch(
          `${API_BASE}/api/trends/leaderboard?category=${encodeURIComponent(category)}&sort=most&limit=30&min_base=1`
        );
        if (!lbRes.ok) throw new Error('leaderboard 실패');
        const lbJson: LeaderboardResp = await lbRes.json();

        if (!mounted) return;

        // 숫자 방어: null → 0 치환
        const sanitized = (brandJson.items ?? []).map((it) => ({
          brand: it.brand,
          base_sum: Number(it.base_sum ?? 0),
          current_sum: Number(it.current_sum ?? 0),
          delta_sum: Number(it.delta_sum ?? 0),
        }));

        setBrands(sanitized);

        const map: Record<string, LeaderboardItem | undefined> = {};
        for (const it of lbJson.items ?? []) {
          if (!map[it.brand]) map[it.brand] = it;
        }
        setRepMap(map);
      } catch {
        if (!mounted) return;
        setErr('A/B 비교 데이터를 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [category]);

  const topList = useMemo(() => {
    if (!brands) return [];
    return [...brands].sort((a, b) => (Number(b.delta_sum ?? 0) - Number(a.delta_sum ?? 0))).slice(0, TOP_N);
  }, [brands]);

  const bottomList = useMemo(() => {
    if (!brands) return [];
    return [...brands].sort((a, b) => (Number(a.delta_sum ?? 0) - Number(b.delta_sum ?? 0))).slice(0, BOTTOM_N);
  }, [brands]);

  // 막대 공통
  const BarRow: React.FC<{
    data: BrandItem;
    maxAbs: number;
  }> = ({ data, maxAbs }) => {
    const brand = data.brand;
    const base_sum = Number(data.base_sum ?? 0);
    const current_sum = Number(data.current_sum ?? 0);
    const delta_sum = Number(data.delta_sum ?? 0);

    // 증가율(%)
    const pct = base_sum > 0 ? ((current_sum / base_sum - 1) * 100) : (current_sum > 0 ? 100 : 0);
    const pctLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;

    const rep = repMap[brand];

    const ratio = maxAbs > 0 ? Math.min(1, Math.abs(delta_sum) / maxAbs) : 0;
    const barStyle: React.CSSProperties = {
      width: `${Math.round(ratio * 100)}%`,
      background: delta_sum >= 0
        ? 'linear-gradient(90deg, #34d399 0%, #059669 100%)'
        : 'linear-gradient(90deg, #fca5a5 0%, #ef4444 100%)',
    };

    return (
      <div className="group relative">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'inline-flex w-1.5 h-1.5 rounded-full',
                delta_sum >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
              )}
            />
            <span className="text-gray-800 font-medium truncate">{brand}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-500 hidden sm:inline">
              A {base_sum.toLocaleString()} → B {current_sum.toLocaleString()}
            </span>
            <span
              className={cn('text-xs font-semibold', delta_sum >= 0 ? 'text-emerald-700' : 'text-rose-700')}
            >
              Δ {delta_sum.toLocaleString()}
            </span>
            <span
              className="text-[11px] px-1.5 py-0.5 rounded-full text-white"
              style={{ background: 'linear-gradient(135deg, #b4a2f8 0%, #9b87f5 100%)' }}
            >
              {pctLabel}
            </span>
          </div>
        </div>

        <div className="h-2 w-full bg-gray-100 rounded mt-1 overflow-hidden">
          <div className="h-full" style={barStyle} />
        </div>

        {/* 툴팁 */}
        <div className="absolute z-10 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow p-3 text-xs text-gray-700 mt-1">
          <div className="font-semibold text-gray-900 mb-1">{brand}</div>
          {rep ? (
            <>
              <div className="text-gray-600">
                대표 제품: <span className="text-gray-900">{rep.product_name}</span>
              </div>
              {rep.product_url && (
                <div className="mt-1">
                  <a
                    href={rep.product_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline"
                  >
                    구매처 열기
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-500">대표 제품 정보 없음</div>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              A 합계<br />
              <span className="font-medium text-gray-900">{base_sum.toLocaleString()}</span>
            </div>
            <div>
              Δ<br />
              <span className={cn('font-medium', delta_sum >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                {delta_sum.toLocaleString()}
              </span>
            </div>
            <div>
              B 합계<br />
              <span className="font-medium text-gray-900">{current_sum.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="text-sm text-gray-500">불러오는 중…</div>;
  if (err) return <div className="text-sm text-rose-600">{err}</div>;
  if (!brands || brands.length === 0) return <div className="text-sm text-gray-500">데이터가 없습니다.</div>;

  const maxAbs = Math.max(...[...topList, ...bottomList].map((d) => Math.abs(Number(d.delta_sum ?? 0))), 1);

  return (
    <div className="space-y-6">
      {/* 해석 가이드 */}
      <div className="rounded-xl border border-gray-200 p-4 bg-white">
        <div className="text-sm text-gray-700">
          <div className="mb-1">
            <span className="font-semibold text-gray-900">Δ(증가수)</span>가 클수록 “최근 주(B)에 리뷰가 얼마나 더 붙었는가”를 의미.
          </div>
          <div className="mb-1">
            <span className="font-semibold text-gray-900">% (증가율)</span>이 높을수록 “베이스(A) 대비 상대적 성장률”이 큼.
          </div>
          <div>
            <span className="font-semibold text-gray-900">지수 130</span>은 “A 대비 30% 증가한 주”라는 해석.
          </div>
        </div>
      </div>

      {/* Top/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Δ Top {TOP_N} (브랜드)</div>
          <div className="space-y-3">
            {topList.map((b) => (
              <BarRow key={`top-${b.brand}`} data={b} maxAbs={maxAbs} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Δ Bottom {BOTTOM_N} (브랜드)</div>
          <div className="space-y-3">
            {bottomList.map((b) => (
              <BarRow key={`bottom-${b.brand}`} data={b} maxAbs={maxAbs} />
            ))}
          </div>
        </div>
      </div>

      {/* 해석 요약 (Top 7) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="text-sm font-semibold text-gray-900 mb-2">요약(Top {SUMMARY_N})</div>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
          {([...brands]
            .sort((a, b) => Number(b.delta_sum ?? 0) - Number(a.delta_sum ?? 0))
            .slice(0, SUMMARY_N) as BrandItem[]
          ).map((b, i) => {
            const base = Number(b.base_sum ?? 0);
            const curr = Number(b.current_sum ?? 0);
            const delta = Number(b.delta_sum ?? 0);
            const pct = base > 0 ? ((curr / base) - 1) * 100 : (curr > 0 ? 100 : 0);
            const pctLabel = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
            return (
              <li key={`sum-${b.brand}-${i}`}>
                <span className="font-semibold text-gray-900">{b.brand}</span>
                {` 가 최근 주(B)에서 A 대비 `}
                <span className={delta >= 0 ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                  {delta.toLocaleString()} ({pctLabel})
                </span>
                {` 만큼 변화했습니다. (A ${base.toLocaleString()} → B ${curr.toLocaleString()})`}
              </li>
            );
          })}
        </ol>
        <div className="text-xs text-gray-500 mt-2">
          * Δ는 A 대비 B에서의 절대 증가량, 괄호는 상대 증가율입니다.
        </div>
      </div>
    </div>
  );
}
