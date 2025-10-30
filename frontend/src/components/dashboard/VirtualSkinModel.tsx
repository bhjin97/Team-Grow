'use client';

import { motion } from 'framer-motion';
import { Camera } from 'lucide-react';
import * as React from 'react';

export default function VirtualSkinModel() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
    >
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
        <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 mr-2" />
        가상 피부 시뮬레이션
      </h3>

      {/* 얼굴 모델 미리보기 영역 */}
      <div className="aspect-square bg-purple-100 rounded-xl mb-3 sm:mb-4 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-32 h-40 sm:w-40 sm:h-52 bg-purple-200 rounded-full opacity-80" />
        </div>
        <span className="relative z-10 text-sm sm:text-base text-gray-500 font-medium">
          얼굴 모델 미리보기
        </span>
      </div>

      {/* 버튼 영역 */}
      <div className="space-y-2 sm:space-y-3">
        <button
          className="w-full py-2.5 sm:py-3 rounded-xl font-medium text-white shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
          style={{
            background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
          }}
        >
          제품 효과 시뮬레이션
        </button>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <button className="py-2 rounded-lg border-2 border-pink-200 text-pink-600 text-sm sm:text-base font-medium hover:bg-pink-50 transition-colors">
            사용 전
          </button>
          <button className="py-2 rounded-lg border-2 border-pink-200 text-pink-600 text-sm sm:text-base font-medium hover:bg-pink-50 transition-colors">
            사용 후 (30일)
          </button>
        </div>
      </div>
    </motion.div>
  );
}
