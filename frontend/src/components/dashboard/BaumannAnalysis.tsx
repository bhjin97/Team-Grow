// BaumannAnalysis
'use client';

import { motion } from 'framer-motion';
import { LineChart, RefreshCcw } from 'lucide-react';
import * as React from 'react';

interface BaumannAnalysisProps {
  pick: { OD: string; SR: string; PN: string; WT: string };
  code: string;
  koAxisWord: Record<'OD' | 'SR' | 'PN' | 'WT', string>;
  onNavigate?: (page: string) => void;
}

// 공용 pill 버튼
const pill = (active: boolean, tone: 'blue' | 'pink' | 'purple' | 'amber', label: string) => {
  const act = {
    blue: 'bg-blue-500 text-white border-blue-500',
    pink: 'bg-pink-500 text-white border-pink-500',
    purple: 'bg-purple-500 text-white border-purple-500',
    amber: 'bg-amber-500 text-white border-amber-500',
  } as const;
  return (
    <span
      className={[
        'px-3 py-1.5 rounded-lg text-sm font-medium border',
        active ? act[tone] : 'bg-white text-gray-700 border-gray-200',
      ].join(' ')}
    >
      {label}
    </span>
  );
};

export default function BaumannAnalysis({
  pick,
  code,
  koAxisWord,
  onNavigate,
}: BaumannAnalysisProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
    >
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
        <LineChart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mr-2" />
        바우만 피부 분석
      </h3>

      <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
        16가지 과학적 분류 기반 당신의 고유한 피부 타입을 발견하세요.
      </p>

      {/* 축별 판정 */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <div className="p-2 sm:p-3 rounded-xl bg-blue-50 border-2 border-blue-200">
          <div className="text-center mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-700">수분</span>
          </div>
          <div className="flex justify-center space-x-1 sm:space-x-2">
            {pill(pick.OD === 'D', 'blue', '건성')}
            {pill(pick.OD === 'O', 'blue', '지성')}
          </div>
        </div>

        <div className="p-2 sm:p-3 rounded-xl bg-pink-50 border-2 border-pink-200">
          <div className="text-center mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-700">민감도</span>
          </div>
          <div className="flex justify-center space-x-1 sm:space-x-2">
            {pill(pick.SR !== 'R', 'pink', '민감성')}
            {pill(pick.SR === 'R', 'pink', '저항성')}
          </div>
        </div>

        <div className="p-2 sm:p-3 rounded-xl bg-purple-50 border-2 border-purple-200">
          <div className="text-center mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-700">색소침착</span>
          </div>
          <div className="flex justify-center space-x-1 sm:space-x-2">
            {pill(pick.PN === 'P', 'purple', '색소침착')}
            {pill(pick.PN === 'N', 'purple', '비색소')}
          </div>
        </div>

        <div className="p-2 sm:p-3 rounded-xl bg-amber-50 border-2 border-amber-200">
          <div className="text-center mb-2">
            <span className="text-xs sm:text-sm font-semibold text-gray-700">주름</span>
          </div>
          <div className="flex justify-center space-x-1 sm:space-x-2">
            {pill(pick.WT === 'W', 'amber', '주름')}
            {pill(pick.WT === 'T', 'amber', '탄력')}
          </div>
        </div>
      </div>

      {/* 타입 결과 */}
      <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-purple-100 rounded-xl flex items-center justify-between gap-3">
        <p className="text-xs sm:text-sm">
          <span className="font-semibold text-purple-700">당신의 타입: {code}</span>
          <span className="text-gray-600 block sm:inline sm:ml-2 mt-1 sm:mt-0">
            ({koAxisWord.OD}, {koAxisWord.SR}, {koAxisWord.PN}, {koAxisWord.WT})
          </span>
        </p>
        <button
          onClick={() => onNavigate?.('diagnosis')}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm border border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          <LineChart className="w-4 h-4" /> 진단하기
        </button>
      </div>
    </motion.div>
  );
}
