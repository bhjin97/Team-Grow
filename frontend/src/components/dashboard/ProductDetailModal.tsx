'use client';

import { motion, AnimatePresence } from 'framer-motion';
// ✅ [수정] 'Info' 아이콘 추가
import { X, ShoppingCart, Droplet, CircleDollarSign, Info } from 'lucide-react';
import * as React from 'react';

// ✅ [수정] Product 인터페이스에 description 추가
interface Product {
  step: string;
  product_pid: string;
  image_url: string;
  display_name: string;
  reason: string;
  price_krw?: number;
  capacity?: string;
  product_url?: string;
  description?: string; // ✅ 한줄 요약 (rag_text)
}

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
}

// 가격 포맷팅 헬퍼
const formatPrice = (price: number | undefined) => {
  if (price === null || price === undefined) {
    return '가격 정보 없음';
  }
  return `${price.toLocaleString('ko-KR')}원`;
};

export default function ProductDetailModal({
  product,
  onClose,
}: ProductDetailModalProps) {
  return (
    <AnimatePresence>
      {product && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <X className="w-5 h-5" />
            </button>

            {/* 제품 이미지 */}
            <div className="w-full h-64 bg-gray-50 flex items-center justify-center p-4">
              <img
                src={product.image_url}
                alt={product.display_name}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* 제품 정보 */}
            <div className="p-5 sm:p-6">
              <span className="text-sm font-semibold text-pink-600">
                {product.step}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 mb-3 leading-snug">
                {product.display_name}
              </h2>

              {/* 가격, 용량 */}
              <div className="space-y-3">
                <div className="flex items-center text-gray-700">
                  <CircleDollarSign className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="text-sm sm:text-base font-medium">
                    {formatPrice(product.price_krw)}
                  </span>
                </div>
                <div className="flex items-center text-gray-700">
                  <Droplet className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="text-sm sm:text-base">
                    {product.capacity || '용량 정보 없음'}
                  </span>
                </div>
              </div>

              {/* ✅ [신규] 제품 한줄 요약 (description) */}
              {product.description && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-start text-gray-700">
                    <Info className="w-5 h-5 text-pink-500 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                </div>
              )}

              {/* ✅ [수정] 구매 버튼에 상단 마진(mt-5) 추가 */}
              {product.product_url ? (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mt-5 flex items-center justify-center gap-2 py-3 rounded-xl bg-pink-500 text-white font-bold text-base hover:bg-pink-600 transition-colors"
                >
                  <ShoppingCart className="w-5 h-5" />
                  구매하러 가기
                </a>
              ) : (
                <button
                  disabled
                  className="w-full mt-5 py-3 rounded-xl bg-gray-300 text-gray-500 font-bold text-base cursor-not-allowed"
                >
                  구매 링크 없음
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}