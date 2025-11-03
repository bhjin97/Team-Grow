'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Droplet, CircleDollarSign, Info, Heart } from 'lucide-react';
import * as React from 'react';
import { API_BASE } from '../../lib/env'; // ✅ 환경변수 가져오기

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
}

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
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);

  // ✅ 모달 열릴 때 즐겨찾기 여부 확인
  React.useEffect(() => {
    const checkFavorite = async () => {
      if (!product) return;
      const userId = localStorage.getItem('user_id');
      if (!userId) return;

      try {
        const res = await fetch(`${API_BASE}/favorite_products/${userId}`); // ✅ 수정됨
        if (res.ok) {
          const favorites = await res.json();
          const found = favorites.some(
            (item: any) => String(item.product_id) === String(product.product_pid)
          );
          setIsSaved(found);
        } else {
          setIsSaved(false);
        }
      } catch {
        setIsSaved(false);
      }
    };

    setIsSaved(false);
    checkFavorite();
  }, [product]);

  // ✅ 즐겨찾기 추가/해제 토글
  const handleToggleFavorite = async () => {
    if (!product) return;
    const userId = localStorage.getItem('user_id');
    if (!userId) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsSaving(true);
    try {
      if (isSaved) {
        const res = await fetch(
          `${API_BASE}/favorite_products/?user_id=${userId}&product_id=${product.product_pid}`, // ✅ 수정됨
          { method: 'DELETE' }
        );
        if (!res.ok) throw new Error('즐겨찾기 해제 실패');
        setIsSaved(false);
        showToast('즐겨찾기에서 제거되었습니다 💔');
      } else {
        const res = await fetch(
          `${API_BASE}/favorite_products/?user_id=${userId}&product_id=${product.product_pid}`, // ✅ 수정됨
          { method: 'POST' }
        );
        if (!res.ok) throw new Error('즐겨찾기 추가 실패');
        setIsSaved(true);
        showToast('즐겨찾기에 추가되었습니다 ❤️');
      }
    } catch {
      showToast('처리 중 오류가 발생했습니다 ❗');
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ 토스트 메시지 표시 함수
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  return (
    <AnimatePresence>
      {product && (
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

              {/* 이미지 + 하트 */}
              <div className="w-full h-64 bg-gray-50 flex items-center justify-center p-4 relative">
                <img
                  src={product.image_url}
                  alt={product.display_name}
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={handleToggleFavorite}
                  disabled={isSaving}
                  className={`absolute top-4 left-4 p-2 rounded-full shadow-md transition ${
                    isSaved
                      ? 'bg-pink-500 text-white'
                      : 'bg-white text-pink-500 hover:bg-pink-100'
                  }`}
                >
                  <Heart
                    className={`w-6 h-6 ${isSaved ? 'fill-white' : 'fill-none'}`}
                  />
                </button>
              </div>

              {/* 제품 정보 */}
              <div className="p-5 sm:p-6">
                <span className="text-sm font-semibold text-pink-600">
                  {product.step}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 mb-3 leading-snug">
                  {product.display_name}
                </h2>

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

                {/* 구매 버튼 */}
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
        </>
      )}
    </AnimatePresence>
  );
}
