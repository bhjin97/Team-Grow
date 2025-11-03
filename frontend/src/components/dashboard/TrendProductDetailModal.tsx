'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { cn } from '../../lib/utils';

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
  // 백엔드에 있을 수도, 없을 수도 있는 필드들(옵션)
  volume_ml?: number | null;
  volume_text?: string | null; // "50ml / 1.7oz" 같은 자유 텍스트
};

export default function TrendProductDetailModal({
  item,
  onClose,
}: {
  item: LeaderboardItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!item) return null;

  const priceLabel =
    typeof item.price_krw === 'number' && !Number.isNaN(item.price_krw)
      ? `${item.price_krw.toLocaleString()}원`
      : '정보 없음';

  const volumeLabel =
    (typeof item.volume_ml === 'number' && !Number.isNaN(item.volume_ml) && item.volume_ml > 0)
      ? `${item.volume_ml}ml`
      : (item.volume_text?.trim() ? item.volume_text!.trim() : '정보 없음');

  const summaryText = item.rag_text?.trim() ? item.rag_text : '정보 없음';

  const Img = () =>
    item.image_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.image_url}
        alt={item.product_name}
        className="w-full h-full object-cover rounded-xl"
      />
    ) : (
      <div className="w-full h-full rounded-xl bg-gray-100 grid place-items-center text-gray-400 text-xs">
        이미지 없음
      </div>
    );

  return (
    <div className="fixed inset-0 z-[1600]">
      {/* overlay */}
      <button
        aria-label="close overlay"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      {/* modal */}
      <div className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs text-gray-500 truncate">{item.brand || '정보 없음'}</div>
              <div className="text-base font-bold text-gray-900 truncate">{item.product_name || '정보 없음'}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-gray-100 grid place-items-center text-gray-500"
              aria-label="close"
            >
              ✕
            </button>
          </div>

          {/* body */}
          <div className="p-5">
            <div className="grid grid-cols-[120px,1fr] gap-4">
              <div className="w-[120px] h-[120px]">
                <Img />
              </div>

              <div className="space-y-2 text-sm">
                <Row label="가격" value={priceLabel} />
                <Row label="용량" value={volumeLabel} />
                <Row label="한줄 요약" value={summaryText} multiline />
                <div className="pt-1">
                  <a
                    href={item.product_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!item.product_url}
                    className={cn(
                      'inline-flex items-center justify-center px-3 py-2 rounded-lg text-sm font-semibold text-white',
                      item.product_url
                        ? 'cursor-pointer'
                        : 'opacity-60 cursor-not-allowed'
                    )}
                    style={{ background: 'linear-gradient(135deg, #b4a2f8 0%, #9b87f5 100%)' }}
                    onClick={(e) => {
                      if (!item.product_url) e.preventDefault();
                    }}
                  >
                    구매처 열기
                  </a>
                </div>
              </div>
            </div>

            {/* 보조 메타(선택) */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
              <Stat label="A(직전)" value={n(item.a_count)} />
              <Stat label="B(최신)" value={n(item.b_count)} />
              <Stat label="Δ" value={n(item.delta)} accent={item.delta >= 0 ? 'pos' : 'neg'} />
            </div>
          </div>

          {/* footer */}
          <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border border-gray-300 hover:bg-gray-50"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500">{label}</div>
      {multiline ? (
        <div className="text-sm text-gray-900 whitespace-pre-wrap">{value}</div>
      ) : (
        <div className="text-sm text-gray-900">{value}</div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: 'pos' | 'neg';
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-2">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div
        className={cn(
          'text-sm font-semibold',
          accent === 'pos' && 'text-emerald-700',
          accent === 'neg' && 'text-rose-700'
        )}
      >
        {value}
      </div>
    </div>
  );
}

function n(v: number | null | undefined) {
  return typeof v === 'number' && !Number.isNaN(v) ? v.toLocaleString() : '—';
}
