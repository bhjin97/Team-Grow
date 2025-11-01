'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

type Props = {
  rank: number;
  item: {
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
  onOpen: () => void;
};

const SafeImg: React.FC<{ src?: string | null; alt: string }> = ({ src, alt }) => {
  if (!src) {
    return (
      <div className="w-full aspect-square rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
        no image
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="w-full aspect-square object-cover rounded-xl" />;
};

export default function TrendProductCard({ rank, item, onOpen }: Props) {
  const deltaBadge =
    item.delta > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    item.delta < 0 ? 'bg-rose-50 text-rose-700 border-rose-200' :
                     'bg-gray-50 text-gray-700 border-gray-200';

  return (
    // 카드 루트는 클릭 방해 요소가 되지 않도록 relative만 주고 pointer-events 기본값 유지
    <div className="relative rounded-2xl border-2 border-gray-100 p-3 bg-white flex flex-col">
      {/* 혹시 상단 배지/리본이 absolute라면 반드시 pointer-events-none */}
      <div className="flex items-center gap-2 mb-2 pointer-events-none">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-purple-600 text-white text-xs font-bold">
          {rank}
        </span>
        <div className="text-xs text-gray-500 truncate">리뷰 {item.b_count.toLocaleString()}</div>
      </div>

      <SafeImg src={item.image_url || undefined} alt={item.product_name} />

      <div className="mt-2">
        <div className="text-xs text-gray-500 truncate">{item.brand}</div>
        <div className="text-sm font-semibold text-gray-900 line-clamp-2">{item.product_name}</div>
        <div className={cn('inline-flex mt-1 px-2 py-0.5 rounded border text-[11px] font-medium', deltaBadge)}>
          {item.delta >= 0 ? `+${item.delta.toLocaleString()}` : item.delta.toLocaleString()} / {item.pct}%
        </div>
        <p className="text-xs text-gray-500 mt-2 line-clamp-2">
          {item.rag_text || '요즘 후기에서 자주 보이는 제품이에요.'}
        </p>
      </div>

      <div className="mt-auto flex items-center gap-2 pt-2">
        {item.product_url && (
          <a
            href={item.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center text-xs font-medium rounded-lg border-2 border-gray-200 px-2 py-1 hover:bg-gray-50"
          >
            구매처 열기
          </a>
        )}

        {/* ▼▼ 클릭 우선권 강제: z-10 + pointer-events-auto + 전파 차단 */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpen?.();
          }}
          className="relative z-10 pointer-events-auto flex-1 text-center text-xs font-medium rounded-lg px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-purple-300"
          style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
          data-testid="trend-open-btn"
        >
          분석 펼쳐보기
        </button>
      </div>

      {/* 혹시 다른 absolute 오버레이가 있다면 반드시 pointer-events-none로! */}
      {/* <div className="absolute inset-0 pointer-events-none" /> */}
    </div>
  );
}
