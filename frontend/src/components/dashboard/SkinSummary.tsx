'use client';

import * as React from 'react';
import { Sparkles, Droplets, Star } from 'lucide-react'; // 아이콘 추가

type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';

interface SkinSummaryProps {
  code: string;
  koAxisWord: Record<AxisKey, string>;
  concerns: { key: AxisKey; label: string; value: number }[];
  selectedPeriod: string;
  setSelectedPeriod: (v: string) => void;
}

export default function SkinSummary({
  code,
  koAxisWord,
  concerns,
  selectedPeriod,
  setSelectedPeriod,
}: SkinSummaryProps) {
  const axisDesc = `(${koAxisWord.OD}, ${koAxisWord.SR}, ${koAxisWord.PN}, ${koAxisWord.WT})`;

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-4 sm:p-6 mb-6">
      {/* 1. 섹션 타이틀 */}
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 text-pink-500">
            <Star size={18} />
          </span>
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">피부 요약</h2>
        </div>
        <p className="text-sm text-gray-500 mt-2 pl-[2.5rem]">
          최근 진단을 기반으로 한 바우만 타입과 주요 축 지표입니다.
        </p>
      </div>

      {/* 2. 바우만 타입 헤더 + 기간 토글 */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-4">
          {/* 왼쪽: 바우만 타입 */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 text-pink-500">
                <Droplets size={18} />
              </span>
              <p className="text-lg sm:text-xl font-semibold text-gray-800">
                바우만 피부 타입 {code}
              </p>
            </div>
            {/* 설명 텍스트 아이콘 라인 기준 정렬 */}
            <p className="text-sm text-gray-500 mt-2 pl-[2.5rem]">{axisDesc}</p>
          </div>

          {/* 오른쪽: 기간 토글 */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPeriod('7days')}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                selectedPeriod === '7days' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              7일
            </button>
            <button
              onClick={() => setSelectedPeriod('30days')}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                selectedPeriod === '30days' ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              30일
            </button>
          </div>
        </div>
      </div>

      {/* 3. 진행바 목록 */}
      <div className="space-y-3">
        {concerns.map(c => (
          <div key={c.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700">{c.label}</span>
              <span className="text-sm text-pink-600 font-semibold">{c.value}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-pink-400 via-fuchsia-400 to-purple-400"
                style={{ width: `${c.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
