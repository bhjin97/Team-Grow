'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../../lib/env';
import { cn } from '../../lib/utils';
import TrendProductCard from './TrendProductCard';
import TrendProductDetailModal from './TrendProductDetailModal';
import TrendAnalysisModal from './TrendAnalysisModal';


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
  pct: number;   // 백엔드에서 여전히 내려주므로 유지
  index: number; // 백엔드에서 여전히 내려주므로 유지
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
  <section className={cn('bg-white rounded-2xl shadow-lg p-4 sm:p-6', className)}>
    {title && (
      <div className="mb-3">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>}
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

  // 상세보기(작은) 모달
  const [activeItem, setActiveItem] = useState<LeaderboardItem | null>(null);
  // 분석 상세(큰) 모달
  const [analysisOpen, setAnalysisOpen] = useState(false);

  // 카테고리 로드
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
    return () => {
      mounted = false;
    };
  }, []);

  // 랭킹 로드
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
        url.searchParams.set('limit', '7');
        url.searchParams.set('min_base', '75'); // 기본값(초기노출 vs 안정성 절충)
        const res = await fetch(url.toString());
        const data: LeaderboardResp = await res.json();
        if (!mounted) return;
        setList(data.items || []);
        setMeta(data.meta);
      } catch {
        if (!mounted) return;
        setErr('랭킹을 불러오지 못했습니다.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [category, sort]);

  const headerNote = useMemo(() => {
    if (!meta) return '';
    const tag = sort === 'hot' ? '증가수' : sort === 'pct' ? '증가율' : '최신 리뷰수';
    return `A=${meta.a_date} → B=${meta.b_date} · 기준=${tag} · 베이스 하한≥${meta.min_base}`;
  }, [meta, sort]);

  return (
    <SectionShell
      title="지금 뜨는 제품 랭킹"
      subtitle="카테고리별로 요즘 리뷰가 늘고 있는 제품들을 모아봤어요. 카드를 눌러 상세 정보를 확인하세요."
      className="lg:col-span-2"
    >
      {/* 컨트롤 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="py-2 pl-3 pr-8 rounded-xl border-2 border-gray-200 text-sm focus:outline-none focus:border-purple-400"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">정렬</label>
          <div className="flex rounded-xl border-2 border-gray-200 p-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSort(opt.key)}
                className={cn(
                  'px-3 py-1 rounded-lg text-sm',
                  sort === opt.key ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-600'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-gray-500 sm:ml-auto">{headerNote}</div>
      </div>

      {/* 카드 스트립 */}
      <div className="relative">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && err && <div className="text-center text-red-600 text-sm py-8">{err}</div>}
        {!loading && !err && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {list.map((item, idx) => (
              <TrendProductCard
                key={item.pid}
                rank={idx + 1}
                item={item}
                onOpen={() => setActiveItem(item)} // 작은 모달
              />
            ))}
          </div>
        )}
      </div>

      {/* 하단 액션: 분석 상세 보기(대형 모달) */}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => setAnalysisOpen(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #b4a2f8 0%, #9b87f5 100%)' }}
        >
          분석 상세 보기
        </button>
      </div>

      {/* 제품 상세보기 (작은) 모달 */}
      {activeItem && (
        <TrendProductDetailModal
          item={activeItem}
          onClose={() => setActiveItem(null)}
        />
      )}

      {/* 대형 분석 모달 */}
      <TrendAnalysisModal
        open={analysisOpen}
        category={category}
        onClose={() => setAnalysisOpen(false)}
      />
    </SectionShell>
  );
}
