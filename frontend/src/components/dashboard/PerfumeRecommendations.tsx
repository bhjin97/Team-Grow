'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import * as React from 'react';

interface Perfume {
  name: string;
  notes: string;
  match: string;
}

interface PerfumeRecommendationsProps {
  selectedWeather: string;
  setSelectedWeather: (v: string) => void;
  selectedMood: string;
  setSelectedMood: (v: string) => void;
  perfumeRecommendations: Perfume[];
}

export default function PerfumeRecommendations({
  selectedWeather,
  setSelectedWeather,
  selectedMood,
  setSelectedMood,
  perfumeRecommendations,
}: PerfumeRecommendationsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
    >
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
        <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500 mr-2" />
        향수 추천
      </h3>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div>
          <label className="text-xs text-gray-600 mb-1 block">날씨</label>
          <select
            value={selectedWeather}
            onChange={e => setSelectedWeather(e.target.value)}
            className="w-full px-2 sm:px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
          >
            <option value="sunny">☀️ Sunny</option>
            <option value="rainy">🌧️ Rainy</option>
            <option value="cloudy">☁️ Cloudy</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 mb-1 block">기분</label>
          <select
            value={selectedMood}
            onChange={e => setSelectedMood(e.target.value)}
            className="w-full px-2 sm:px-3 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
          >
            <option value="fresh">✨ Fresh</option>
            <option value="romantic">💕 Romantic</option>
            <option value="confident">💪 Confident</option>
          </select>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-3">
        {perfumeRecommendations.map((perfume, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.5 + index * 0.1 }}
            className="p-3 sm:p-4 rounded-xl bg-pink-50 border border-pink-100 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex justify-between items-start mb-1 sm:mb-2">
              <h4 className="text-sm sm:text-base font-semibold text-gray-800">
                {perfume.name}
              </h4>
              <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-1 rounded-full flex-shrink-0">
                {perfume.match}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-600">{perfume.notes}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
