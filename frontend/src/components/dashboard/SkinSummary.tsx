'use client';

import { motion } from 'framer-motion';
import { Droplets, Sparkles } from 'lucide-react';
import * as React from 'react';

type Concern = { key: string; label: string; value: number };

interface SkinSummaryProps {
  code: string; // 예: "ORNT"
  koAxisWord: Record<'OD' | 'SR' | 'PN' | 'WT', string>;
  concerns: Concern[]; // 각 축별 confidence(%)
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-4 sm:mb-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center">
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500 mr-2" />
          피부 요약
        </h3>
        <select
          value={selectedPeriod}
          onChange={e => setSelectedPeriod(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        >
          <option value="7days">최근 7일</option>
          <option value="30days">최근 30일</option>
          <option value="90days">최근 90일</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* Score Section */}
        <div className="md:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">피부 건강 점수</span>
            <span className="text-2xl font-bold text-pink-600">95/100</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '95%' }}
              transition={{ duration: 1, delay: 0.3 }}
              className="bg-gradient-to-r from-pink-300 to-purple-300 h-3 rounded-full"
            />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-1">
            <div className="flex items-center space-x-2 text-sm">
              <Droplets className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600">바우만 타입:</span>
              <span className="font-semibold text-gray-800">{code}</span>
            </div>
            <div className="text-xs text-gray-500">
              ({koAxisWord.OD}, {koAxisWord.SR}, {koAxisWord.PN}, {koAxisWord.WT})
            </div>
          </div>
        </div>

        {/* Top Concerns Section */}
        <div className="md:col-span-2">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">주요 피부 고민</h4>
          <div className="space-y-3">
            {concerns.map((item, index) => (
              <div key={item.key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    {item.label}
                  </span>
                  <span className="text-sm font-semibold text-purple-600">{item.value}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.value}%` }}
                    transition={{ duration: 0.8, delay: 0.4 + index * 0.1 }}
                    className="bg-gradient-to-r from-purple-300 to-pink-300 h-2 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
