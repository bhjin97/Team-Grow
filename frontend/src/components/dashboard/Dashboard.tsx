'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardBottomNav from './DashboardBottomNav';

// 기능 컴포넌트
import SkinSummary from './SkinSummary';
import PerfumeRecommendations from './PerfumeRecommendations';
import BaumannAnalysis from './BaumannAnalysis';
import VirtualSkinModel from './VirtualSkinModel';
import CustomRoutine from './CustomRoutine';

// 타입 정의
type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';
type AxisBrief = { avg: number; letter: string; confidence: number };
type AxesJSON = Record<AxisKey, AxisBrief>;

export interface DashboardProps {
  userName?: string;
  onNavigate?: (page: string) => void;
}

export default function Dashboard({ userName = 'Sarah', onNavigate }: DashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedWeather, setSelectedWeather] = useState('sunny');
  const [selectedMood, setSelectedMood] = useState('fresh');
  const [season, setSeason] = useState('summer');
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [baumannType, setBaumannType] = useState<string>('ORNT');
  const [axes, setAxes] = useState<AxesJSON | null>(null);
  const [routineProducts, setRoutineProducts] = useState<any[]>([]);

  // 키워드 규칙
  const FOCUS_RULES: Record<string, string[]> = {
    summer_morning: ['가벼운', '산뜻'],
    summer_evening: ['보습', '진정'],
    winter_morning: ['보습', '보호막'],
    winter_evening: ['영양', '재생'],
  };
  const allKeywordOptions = Array.from(new Set(Object.values(FOCUS_RULES).flat()));
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(FOCUS_RULES[`${season}_${timeOfDay}`] || []);
  const toggleKeyword = (kw: string) => {
    if (selectedKeywords.includes(kw)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== kw));
    } else if (selectedKeywords.length < 2) {
      setSelectedKeywords([...selectedKeywords, kw]);
    }
  };

  // 바우만 타입 파싱
  const code = (baumannType ?? 'ORNT').toUpperCase();
  const pick = { OD: code[0], SR: code[1], PN: code[2], WT: code[3] };
  const koAxisWord = {
    OD: pick.OD === 'O' ? '지성' : '건성',
    SR: pick.SR === 'R' ? '저항성' : '민감성',
    PN: pick.PN === 'N' ? '비색소침착' : '색소침착',
    WT: pick.WT === 'T' ? '탱탱함' : '주름',
  };
  const concernLabel: Record<AxisKey, string> = {
    OD: pick.OD === 'O' ? 'OILY' : 'DRY',
    SR: pick.SR === 'R' ? 'RESISTANCE' : 'SENSITIVE',
    PN: pick.PN === 'N' ? 'NON-PIGMENTED' : 'PIGMENTED',
    WT: pick.WT === 'T' ? 'TIGHT' : 'WRINKLED',
  };
  const concerns = useMemo(() => {
    return (['OD', 'SR', 'PN', 'WT'] as AxisKey[]).map(ax => ({
      key: ax,
      label: concernLabel[ax],
      value: axes?.[ax]?.confidence ? Math.round(axes![ax].confidence) : 0,
    }));
  }, [axes, baumannType]);

  // 향수 추천 더미
  const perfumeRecommendations = [
    { name: 'Fresh Citrus', notes: 'Bergamot, Lemon, White Tea', match: '95%' },
    { name: 'Spring Garden', notes: 'Jasmine, Rose, Green Leaves', match: '88%' },
    { name: 'Ocean Breeze', notes: 'Sea Salt, Mint, Amber', match: '82%' },
  ];

  return (
    <div className="min-h-screen w-full pb-16 md:pb-0"
         style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)' }}>
      
      {/* ✅ 상단 헤더 */}
      <DashboardHeader userName={userName} onNavigate={onNavigate} />

      {/* ✅ 메인 콘텐츠 */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        <SkinSummary
          code={code}
          koAxisWord={koAxisWord}
          concerns={concerns}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
        />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <PerfumeRecommendations
            selectedWeather={selectedWeather}
            setSelectedWeather={setSelectedWeather}
            selectedMood={selectedMood}
            setSelectedMood={setSelectedMood}
            perfumeRecommendations={perfumeRecommendations}
          />
          <BaumannAnalysis pick={pick} code={code} koAxisWord={koAxisWord} onNavigate={onNavigate} />
          <VirtualSkinModel />
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
          />
        </div>
      </main>

      {/* ✅ 하단 네비게이션 */}
      <DashboardBottomNav onNavigate={onNavigate} />
    </div>
  );
}
