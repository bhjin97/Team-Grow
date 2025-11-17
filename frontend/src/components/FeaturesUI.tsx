'use client';

import * as React from 'react';
import DashboardHeader from './dashboard/DashboardHeader';
import DashboardBottomNav from './dashboard/DashboardBottomNav';
import BaumannAnalysis from './dashboard/BaumannAnalysis';
import VirtualSkinModel from './dashboard/VirtualSkinModel';
import CustomRoutine from './dashboard/CustomRoutine';
import PerfumeRecommendations from './dashboard/PerfumeRecommendations';

interface FeaturesUIProps {
  userName?: string;
  onNavigate?: (page: string) => void;
  currentPage?: string;
  baumannType: string;
  setBaumannType: (type: string) => void;
  userId?: number;
  pick: { OD: string; SR: string; PN: string; WT: string };
  code: string;
  koAxisWord: {
    OD: string;
    SR: string;
    PN: string;
    WT: string;
  };
  selectedWeather: string;
  setSelectedWeather: (weather: string) => void;
  selectedMood: string;
  setSelectedMood: (mood: string) => void;
  perfumeRecommendations: Array<{ name: string; notes: string; match: string }>;
  season: string;
  setSeason: (season: string) => void;
  timeOfDay: string;
  setTimeOfDay: (time: string) => void;
  allKeywordOptions: string[];
  selectedKeywords: string[];
  toggleKeyword: (kw: string) => void;
  setSelectedKeywords: (keywords: string[]) => void;
  routineProducts: any[];
  setRoutineProducts: (products: any[]) => void;
  onFetchRoutine: () => void;
  resetKeywords: () => void;
}

export default function FeaturesUI({
  userName,
  onNavigate,
  currentPage,
  baumannType,
  setBaumannType,
  userId,
  pick,
  code,
  koAxisWord,
  selectedWeather,
  setSelectedWeather,
  selectedMood,
  setSelectedMood,
  perfumeRecommendations,
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
  onFetchRoutine,
  resetKeywords,
}: FeaturesUIProps) {
  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)' }}
    >
      <DashboardHeader userName={userName} onNavigate={onNavigate} currentPage={currentPage} />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        

        {/* 2열 그리드 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* 가상 피부 시뮬레이터 */}
          <VirtualSkinModel skinType={baumannType} userId={userId} />

          {/* 맞춤 루틴 */}
          <CustomRoutine
            baumannType={baumannType}
            setBaumannType={setBaumannType}
            season={season}
            setSeason={setSeason}
            timeOfDay={timeOfDay}
            setTimeOfDay={setTimeOfDay}
            allKeywordOptions={allKeywordOptions}
            selectedKeywords={selectedKeywords}
            toggleKeyword={toggleKeyword}
            setSelectedKeywords={setSelectedKeywords}
            routineProducts={routineProducts}
            setRoutineProducts={setRoutineProducts}
            onFetchRoutine={onFetchRoutine}
            resetKeywords={resetKeywords}/>

          {/* 향수 추천 */}
          <PerfumeRecommendations
            selectedWeather={selectedWeather}
            setSelectedWeather={setSelectedWeather}
            selectedMood={selectedMood}
            setSelectedMood={setSelectedMood}
            perfumeRecommendations={perfumeRecommendations}
          />

          {/* 바우만 분석 */}
          <BaumannAnalysis pick={pick} code={code} koAxisWord={koAxisWord} onNavigate={onNavigate} />
        </div>
      </main>

      <DashboardBottomNav onNavigate={onNavigate} currentPage={currentPage} />
    </div>
  );
}