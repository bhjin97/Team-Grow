'use client';

import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import * as React from 'react';
import { fetchRoutine } from '../../lib/utils';
import ProductDetailModal from './ProductDetailModal';

// Product 인터페이스 (description 포함)
interface Product {
  step: string;
  product_pid: string;
  image_url: string;
  display_name: string;
  reason: string;
  price_krw?: number;
  capacity?: string;
  product_url?: string;
  description?: string; // 한줄 요약 (rag_text)
}

interface CustomRoutineProps {
  baumannType: string;
  setBaumannType: (v: string) => void;
  season: string;
  setSeason: (v: string) => void;
  timeOfDay: string;
  setTimeOfDay: (v: string) => void;
  allKeywordOptions: string[];
  selectedKeywords: string[];
  toggleKeyword: (kw: string) => void;
  setSelectedKeywords: (v: string[]) => void;
  routineProducts: Product[];
  setRoutineProducts: (v: Product[]) => void;
}

export default function CustomRoutine({
  baumannType,
  setBaumannType,
  season,
  setSeason,
  timeOfDay,
  setTimeOfDay,
  allKeywordOptions,
  selectedKeywords,
  toggleKeyword,
  setSelectedKeywords,
  routineProducts,
  setRoutineProducts,
}: CustomRoutineProps) {
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(
    null
  );

  return (
    <>
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
      >
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
          <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500 mr-2" />
          맞춤 케어 루틴
        </h3>

        {/* 선택 영역 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div>
            <label className="text-xs text-gray-600 mb-1 block">계절</label>
            <select
              value={season}
              onChange={e => setSeason(e.target.value)}
              className="w-full px-1.5 sm:px-2 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              <option value="summer">☀️ 여름</option>
              <option value="winter">❄️ 겨울</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">시간</label>
            <select
              value={timeOfDay}
              onChange={e => setTimeOfDay(e.target.value)}
              className="w-full px-1.5 sm:px-2 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
            >
              <option value="morning">🌅 오전</option>
              <option value="evening">🌙 오후</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 mb-1 block">피부 타입</label>
            <select
              value={baumannType}
              onChange={e => setBaumannType(e.target.value)}
              className="w-full px-1.5 sm:px-2 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="DRNT">DRNT</option>
              <option value="DRNW">DRNW</option>
              <option value="DRPT">DRPT</option>
              <option value="DRPW">DRPW</option>
              <option value="DSPT">DSPT</option>
              <option value="DSPW">DSPW</option>
              <option value="DSNT">DSNT</option>
              <option value="DSNW">DSNW</option>
              <option value="ORNT">ORNT</option>
              <option value="ORNW">ORNW</option>
              <option value="ORPT">ORPT</option>
              <option value="ORPW">ORPW</option>
              <option value="OSPT">OSPT</option>
              <option value="OSPW">OSPW</option>
              {/* ✅ [수정] </Foption> -> </option> 오타 수정 */}
              <option value="OSNT">OSNT</option>
              <option value="OSNW">OSNW</option>
            </select>
          </div>
        </div>

        {/* 키워드 선택 */}
        <div>
          <label className="text-xs text-gray-600 mb-1 block">
            키워드 선택 (최대 2개)
          </label>
          <div className="flex flex-wrap gap-2 items-center mb-4">
            {allKeywordOptions.map(kw => (
              <button
                key={kw}
                type="button"
                onClick={() => toggleKeyword(kw)}
                className={`px-2 py-1 rounded-full text-xs sm:text-sm border 
                   ${
                     selectedKeywords.includes(kw)
                       ? 'bg-pink-200 border-pink-400 text-pink-700 font-semibold'
                       : 'bg-gray-100 border-gray-300 text-gray-600'
                   }`}
              >
                #{kw}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedKeywords([])}
              className="px-3 py-1 rounded-full text-xs sm:text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              초기화
            </button>
          </div>
        </div>

        {/* 추천된 제품 카드 */}
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 sm:gap-4 min-w-max">
            {routineProducts.map((product, index) => (
              <motion.div
                key={product.product_pid}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                className="flex-shrink-0 w-40 sm:w-48 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border-2 border-pink-100 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedProduct(product)}
              >
                <div className="text-xs sm:text-sm font-semibold text-pink-600 mb-1">
                  {product.step}
                </div>
                <div className="w-full aspect-square bg-white rounded-lg mb-2 flex items-center justify-center">
                  <img
                    src={product.image_url}
                    alt={product.display_name}
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
                  {product.display_name}
                </p>
                <p className="text-[11px] text-gray-500">{product.reason}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <button
          onClick={async () => {
            try {
              const data = await fetchRoutine(
                baumannType,
                season,
                timeOfDay,
                selectedKeywords
              );
              setRoutineProducts(data);
            } catch (err) {
              console.error(err);
            }
          }}
          className="w-full mt-3 sm:mt-4 py-2.5 sm:py-3 rounded-xl bg-pink-100 text-pink-700 text-sm sm:text-base font-medium hover:bg-pink-200 transition-colors"
        >
          스킨케어 루틴 추천 받기
        </button>
      </motion.div>
    </>
  );
}