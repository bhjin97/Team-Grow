'use client';

import * as React from 'react';

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
  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-md p-4 sm:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500">바우만 타입</p>
          <h2 className="text-xl font-bold text-gray-800">{code}</h2>
          <p className="text-sm text-gray-600 mt-1">
            ({koAxisWord.OD}, {koAxisWord.SR}, {koAxisWord.PN}, {koAxisWord.WT})
          </p>
        </div>
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

      <div className="space-y-3">
        {concerns.map(c => (
          <div key={c.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-700">{c.label}</span>
              <span className="text-sm text-pink-600 font-semibold">{c.value}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-pink-400 to-purple-400"
                style={{ width: `${c.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
