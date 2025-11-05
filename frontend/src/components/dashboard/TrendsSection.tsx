'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../lib/env';
import { cn } from '../../lib/utils';
import TrendProductCard from './TrendProductCard';
import TrendProductDetailModal from './TrendProductDetailModal';
import TrendAnalysisModal from './TrendAnalysisModal';
import CategoryDonut from './CategoryDonut';
import CategoryOverlay from './CategoryOverlay';

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
  meta: {
    category: string;
    a_date: string;
    b_date: string;
    count: number;
    sort: string;
    min_base: number;
  };
  items: LeaderboardItem[];
};

type CategoryPoint = {
  date: string;
  [cat: string]: any;
};
type CategoryTsResp = {
  series: CategoryPoint[];
  categories: string[];
};

const SORT_OPTIONS = [
  { key: 'hot',  label: '핫리뷰(증가수)' },
  { key: 'pct',  label: '증가율(%)' },
  { key: 'most', label: '리뷰 많은 순' },
] as const;

const SectionShell: React.FC<{
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}> = ({ children, className, title, subtitle }) => (
  <section className={cn('bg-white rounded-2xl shadow p-3 sm:p-4', className)}>
    {title && (
      <div className="mb-2">
        <h3 className="text-base sm:text-lg font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
    )}
    {children}
  </section>
);

export default function TrendsSection() {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('');
  const [sort, setSort] = useState<'hot' | 'pct' | 'most'>('hot');
  const [list, setList] = useState<LeaderboardItem[]>([]);
  const [meta, setMeta] = useState<LeaderboardResp['meta'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [activeItem, setActiveItem] = useState<LeaderboardItem | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const [catTs, setCatTs] = useState<CategoryTsResp | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/trends/categories`);
        const data: string[] = await res.json();
        if (!mounted) return;
        setCategories(data);
        setCategory((prev) => prev || data[0] || '');
      } catch {
        if (!mounted) return;
        setErr('카테고리 목록을 불러오지 못했습니다.');
      }
    })();
    return () => { mounted = false; };
  }, []);

  // 오른쪽 카드: 2개만
  useEffect(() => {
    if (!category) return;
    let mounted = true;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const url = new URL(`${API_BASE}/api/trends/leaderboard`);
        url.searchParams.set('category', category);
        url.searchParams.set('sort', sort);
        url.searchParams.set('limit', '3');
        url.searchParams.set('min_base', '75');
        const res = await fetch(url.toString());
        const data: LeaderboardResp = await res.json();
        if (!mounted) return;
        setList((data.items || []).slice(0, 3)); // ★ 보수
        setMeta(data.meta);
      } catch {
        if (!mounted) return;
        setErr('랭킹을 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [category, sort]);

  // 카테고리 타임시리즈
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/trends/category_timeseries`);
        const data: CategoryTsResp = await res.json();
        if (!mounted) return;
        setCatTs(data);
      } catch {}
    })();
    return () => { mounted = false; };
  }, []);

  const headerNote = useMemo(() => {
    if (!meta) return '';
    const tag = sort === 'hot' ? '증가수' : sort === 'pct' ? '증가율' : '최신 리뷰수';
    return `A=${meta.a_date} → B=${meta.b_date} · 기준=${tag} · 베이스 하한≥${meta.min_base}`;
  }, [meta, sort]);

  const donutData = useMemo(() => {
    if (!catTs?.series?.length || !catTs?.categories?.length) return null;
    const lastRow = catTs.series[catTs.series.length - 1];
    const row = catTs.series.find((r) => r.date === hoveredDate) ?? lastRow;
    return catTs.categories.map((c) => ({
      label: c,
      value: Number(row[c]?.sum ?? 0),
    }));
  }, [catTs, hoveredDate]);

  return (
    <SectionShell
      title="지금 뜨는 제품 랭킹"
      subtitle="왼쪽은 카테고리 비중, 가운데는 카테고리 추이, 오른쪽은 상위 제품 카드입니다."
      className="lg:col-span-2"
    >
      {/* 컨트롤 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="py-1.5 pl-3 pr-8 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-purple-400"
          >
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">정렬</label>
          <div className="flex rounded-xl border-2 border-gray-200 p-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={cn('px-2.5 py-1 rounded-lg text-sm', sort === opt.key ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-600')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-[11px] text-gray-500 sm:ml-auto">{headerNote}</div>
      </div>

      
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr_2fr] gap-3">
        {/* (1) 도넛 - 3fr */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 min-w-0">
          {!donutData ? (
            <div className="text-sm text-gray-500">데이터가 없습니다.</div>
          ) : (
            <CategoryDonut
              title="카테고리 비중"
              data={donutData}
              size={220}
              thickness={22}
              hoveredLabel={null}
              onSliceHover={() => {}}
            />
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3 min-w-0 overflow-hidden">
          <div className="text-sm font-semibold text-gray-900 mb-2">카테고리 비교</div>
          {catTs?.series?.length ? (
            <CategoryOverlay
              series={catTs.series}
              categories={catTs.categories}
              hoveredDate={hoveredDate}
              onHover={setHoveredDate}
              useIndex={false}
              padFrac={0.15}
              minSpan={80}
            />
          ) : (
            <div className="text-sm text-gray-500">데이터가 없습니다.</div>
          )}
        </div>


        {/* (3) 카드 - 2fr (compact 2개) */}
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="text-sm font-semibold text-gray-900 mb-2">상위 제품</div>
          <div className="grid grid-cols-1 gap-3">
            {loading && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse" />
            ))}
            {!loading && err && <div className="text-center text-red-600 text-sm py-8">{err}</div>}
            {!loading && !err && list.map((item, idx) => (
              <TrendProductCard
                key={item.pid}
                rank={idx + 1}
                item={item}
                onOpen={() => setActiveItem(item)}
                variant="compact"
              />
            ))}
          </div>
        </div>
      </div>

      {/* 하단 액션 */}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setAnalysisOpen(true)}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #b4a2f8 0%, #9b87f5 100%)' }}
        >
          분석 상세 보기
        </button>
      </div>

      {activeItem && (
        <TrendProductDetailModal item={activeItem} onClose={() => setActiveItem(null)} />
      )}
      <TrendAnalysisModal
        open={analysisOpen}
        category={category}
        onClose={() => setAnalysisOpen(false)}
      />
    </SectionShell>
  );
}
