'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

type Item = {
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

type Props = {
  rank: number;
  item: Item;
  onOpen: () => void;
  /** 카드 크기: 기본(default) / 컴팩트(compact) */
  variant?: 'default' | 'compact';
};

function SafeImg({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const fallback =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="#f5f5f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="#9ca3af">No Image</text></svg>'
    );
  return <img src={src || fallback} alt={alt} className={className} />;
}

export default function TrendProductCard({ rank, item, onOpen, variant = 'default' }: Props) {
  const compact = variant === 'compact';

  const deltaBadge =
    item.delta >= 0
      ? 'text-emerald-700 border-emerald-100 bg-emerald-50'
      : 'text-rose-700 border-rose-100 bg-rose-50';

  // ────────────────────── compact: 가로형 초소형 카드 ──────────────────────
  if (compact) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-2">
        <div className="flex items-start gap-2">
          <div className="relative shrink-0">
            <SafeImg
              src={item.image_url}
              alt={item.product_name}
              className="w-16 h-16 object-cover rounded-md"
            />
            <span className="absolute -top-1 -left-1 w-5 h-5 grid place-items-center rounded-md bg-purple-600 text-white text-[10px] font-bold">
              {rank}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-gray-500 truncate">{item.brand}</span>
              <span
                className={cn(
                  'shrink-0 inline-flex px-1.5 py-0.5 rounded border text-[10px] leading-none',
                  deltaBadge
                )}
                title="증가수 / 증가율"
              >
                {item.delta >= 0 ? `+${item.delta.toLocaleString()}` : item.delta.toLocaleString()} / {item.pct}%
              </span>
            </div>
            <div className="text-[12px] font-semibold text-gray-900 leading-snug line-clamp-2 mt-0.5">
              {item.product_name}
            </div>

            <div className="flex items-center gap-1 mt-1">
              {item.product_url && (
                <a
                  href={item.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] px-2 py-0.5 rounded border border-gray-200 hover:bg-gray-50"
                >
                  구매
                </a>
              )}
              <button
                type="button"
                onClick={onOpen}
                className="text-[11px] px-2 py-0.5 rounded text-white"
                style={{ background: 'linear-gradient(135deg, #b4a2f8 0%, #9b87f5 100%)' }}
              >
                분석
              </button>
              <span className="ml-auto text-[10px] text-gray-500">리뷰 {item.b_count.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────── default: 기존 카드(그대로) ──────────────────────
  return (
    <div className={cn('relative rounded-2xl border-2 border-gray-100 bg-white flex flex-col p-3')}>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center rounded-lg bg-purple-600 text-white font-bold w-6 h-6 text-xs">
          {rank}
        </span>
        <div className="text-xs text-gray-500 truncate">리뷰 {item.b_count.toLocaleString()}</div>
      </div>

      <SafeImg
        src={item.image_url}
        alt={item.product_name}
        className="w-full aspect-square object-cover rounded-xl"
      />

      <div className="mt-2">
        <div className="text-xs text-gray-500 truncate">{item.brand}</div>
        <div className="text-sm font-semibold text-gray-900 line-clamp-2">{item.product_name}</div>

        <div
          className={cn(
            'inline-flex mt-1 px-2 py-0.5 rounded border text-[11px] font-medium',
            deltaBadge
          )}
        >
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
            className="flex-1 text-center rounded-lg border-2 border-gray-200 hover:bg-gray-50 text-xs px-2 py-1 font-medium"
          >
            구매
          </a>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="relative z-10 pointer-events-auto flex-1 text-center text-white focus:outline-none focus:ring-2 focus:ring-purple-300 rounded-lg text-xs px-2 py-1 font-medium"
          style={{ background: 'linear-gradient(135deg, #b4a2f8 0%, #9b87f5 100%)' }}
        >
          분석
        </button>
      </div>
    </div>
  );
}
