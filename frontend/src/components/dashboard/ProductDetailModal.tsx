'use client';

import { API_BASE } from '@/lib/env';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Droplet, CircleDollarSign, Info, Heart } from 'lucide-react';
import * as React from 'react';

// Product 인터페이스
interface Product {
  step: string;
  product_pid: string;
  image_url: string;
  display_name: string;
  reason: string;
  price_krw?: number;
  capacity?: string;
  product_url?: string;
  description?: string;
}

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onToggleFavorite?: (pid: string | number) => void;
  favorites?: number[];
  mode?: 'routine' | 'profile';
}

const formatPrice = (price: number | undefined) => {
  if (price === null || price === undefined) return '가격 정보 없음';
  return `${price.toLocaleString('ko-KR')}원`;
};

export default function ProductDetailModal({
  product,
  onClose,
  onToggleFavorite,
  favorites = [],
  mode,
}: ProductDetailModalProps) {
  const [isSaved, setIsSaved] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);
  const [detailedProduct, setDetailedProduct] = React.useState<Product | null>(product); // ✅ 추가
  const handleClose = () => {
  setDetailedProduct(null); // 내부 상태 비우기
  onClose(); // 부모 컴포넌트에도 닫기 전달
};

  // ✅ 부모의 favorites가 바뀌면 즉시 반영
  React.useEffect(() => {
    if (!product) return;
    const found = favorites.includes(Number(product.product_pid));
    setIsSaved(found);
  }, [favorites, product]);

  // ✅ 누락된 상세정보 자동 보완
  React.useEffect(() => {
    if (!product) return;

    // 이미 용량/설명 데이터가 있다면 fetch 생략
    if (product.capacity && product.description) {
      setDetailedProduct(product);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/product/detail/${product.product_pid}`);
        if (res.ok) {
          const data = await res.json();
          setDetailedProduct({
            ...product,
            capacity: data.capacity || '용량 정보 없음',
            description: data.description || '제품 설명이 없습니다.',
            price_krw: data.price_krw ?? product.price_krw ?? 0,
            product_url: data.product_url || product.product_url,
          });
        } else {
          setDetailedProduct(product);
        }
      } catch (err) {
        console.error('❌ 자동 상세정보 불러오기 실패:', err);
        setDetailedProduct(product);
      }
    })();
  }, [product]);

  // ✅ 하트 버튼 클릭 시 부모 함수 호출
  const handleToggleFavorite = () => {
    if (!detailedProduct) return;
    onToggleFavorite?.(detailedProduct.product_pid);
    setIsSaved(!isSaved);
    showToast(isSaved ? '즐겨찾기에서 제거되었습니다 💔' : '즐겨찾기에 추가되었습니다 ❤️');
  };

  // ✅ 토스트 메시지 표시 함수
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  return (
    <AnimatePresence>
      {detailedProduct && (
        <>
          {/* ✅ 토스트 메시지 */}
          <AnimatePresence>
            {toastMsg && (
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-[999]"
              >
                {toastMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ✅ 메인 모달 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 닫기 버튼 */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                <X className="w-5 h-5" />
              </button>

              {/* 이미지 + 하트 */}
              <div className="w-full h-64 bg-gray-50 flex items-center justify-center p-4 relative">
                <img
                  src={detailedProduct.image_url}
                  alt={detailedProduct.display_name}
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={() => {
                    // ✅ 항상 숫자형으로 변환하여 전달
                    const pid = Number(detailedProduct.product_pid);
                    console.log("❤️ 즐겨찾기 클릭됨:", pid, typeof pid);

                    // ✅ mode와 상관없이 onToggleFavorite이 있으면 실행
                    if (onToggleFavorite) {
                      onToggleFavorite(pid);
                    } else {
                      handleToggleFavorite();
                    }
                  }}
                  className={`absolute top-4 left-4 p-2 rounded-full shadow-md transition ${
                    isSaved
                      ? 'bg-pink-500 text-white'
                      : 'bg-white text-pink-500 hover:bg-pink-100'
                  }`}
                >
                  <Heart className={`w-6 h-6 ${isSaved ? 'fill-white' : 'fill-none'}`} />
                </button>
              </div>

              {/* 제품 정보 */}
              <div className="p-5 sm:p-6">
                <span className="text-sm font-semibold text-pink-600">
                  {detailedProduct.step}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 mb-3 leading-snug">
                  {detailedProduct.display_name}
                </h2>

                <div className="space-y-3">
                  <div className="flex items-center text-gray-700">
                    <CircleDollarSign className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-sm sm:text-base font-medium">
                      {formatPrice(detailedProduct.price_krw)}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-700">
                    <Droplet className="w-5 h-5 text-gray-400 mr-2 flex-shrink-0" />
                    <span className="text-sm sm:text-base">
                      {detailedProduct.capacity || '용량 정보 없음'}
                    </span>
                  </div>
                </div>

                {detailedProduct.description && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-start text-gray-700">
                      <Info className="w-5 h-5 text-pink-500 mr-2 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {detailedProduct.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* 구매 버튼 */}
                {detailedProduct.product_url ? (
                  <a
                    href={detailedProduct.product_url}
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
        </>
      )}
    </AnimatePresence>
  );
}
