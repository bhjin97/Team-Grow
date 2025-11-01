'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';

import DashboardHeader from './DashboardHeader';
import DashboardBottomNav from './DashboardBottomNav';

import SkinSummary from './SkinSummary';
import PerfumeRecommendations from './PerfumeRecommendations';
import BaumannAnalysis from './BaumannAnalysis';
import VirtualSkinModel from './VirtualSkinModel';
import CustomRoutine from './CustomRoutine';
import TrendsSection from './TrendsSection';

import { fetchRoutine } from '../../lib/utils'; 
// ⚠️ API_BASE는 여기서 안 쓰이므로 import 제거

type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';
type AxisBrief = { avg: number; letter: string; confidence: number };
type AxesJSON = Record<AxisKey, AxisBrief>;

export interface DashboardProps {
  userName?: string;
  onNavigate?: (page: string) => void;
}

export default function Dashboard({ userName = 'Sarah', onNavigate }: DashboardProps) {
  // --- 대시보드 상태 ---
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedWeather, setSelectedWeather] = useState('sunny');
  const [selectedMood, setSelectedMood] = useState('fresh');
  const [season, setSeason] = useState('summer');
  const [timeOfDay, setTimeOfDay] = useState('morning');

  const [baumannType, setBaumannType] = useState<string>('ORNT');
  const [axes, setAxes] = useState<AxesJSON | null>(null);
  const [routineProducts, setRoutineProducts] = useState<any[]>([]);

  // --- 키워드 룰 ---
  const FOCUS_RULES: Record<string, string[]> = {
    summer_morning: ['가벼운', '산뜻'],
    summer_evening: ['보습', '진정'],
    winter_morning: ['보습', '보호막'],
    winter_evening: ['영양', '재생'],
  };
  const allKeywordOptions = Array.from(new Set(Object.values(FOCUS_RULES).flat()));
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(
    FOCUS_RULES[`${season}_${timeOfDay}`] || []
  );

  const toggleKeyword = (kw: string) => {
    if (selectedKeywords.includes(kw)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== kw));
    } else if (selectedKeywords.length < 2) {
      setSelectedKeywords([...selectedKeywords, kw]);
    }
  };

  // --- 축/라벨 계산 ---
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

  const perfumeRecommendations = [
    { name: 'Fresh Citrus', notes: 'Bergamot, Lemon, White Tea', match: '95%' },
    { name: 'Spring Garden', notes: 'Jasmine, Rose, Green Leaves', match: '88%' },
    { name: 'Ocean Breeze', notes: 'Sea Salt, Mint, Amber', match: '82%' },
  ];

  // --- 프로필/축 로드 ---
  useEffect(() => {
    const cachedType = localStorage.getItem('skin_type_code');
    const cachedAxes = localStorage.getItem('skin_axes_json');
    if (cachedType) setBaumannType(cachedType);
    if (cachedAxes) try { setAxes(JSON.parse(cachedAxes)); } catch {}

    const userIdStr = localStorage.getItem('user_id') ?? '1';
    const userId = Number.parseInt(userIdStr, 10) || 1;

    (async () => {
      try {
        // 백엔드에서 /api/profile/{id} 제공 중(프로젝트 기존 로직)
        const base = (await import('../../lib/env')).API_BASE;
        if (!base) return;
        const res = await fetch(`${base}/api/profile/${userId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.skin_type_code) {
          const newType = String(data.skin_type_code);
          setBaumannType(newType);
          localStorage.setItem('skin_type_code', newType);
        }
        if (data?.skin_axes_json) {
          const json = typeof data.skin_axes_json === 'string'
            ? data.skin_axes_json
            : JSON.stringify(data.skin_axes_json);
          localStorage.setItem('skin_axes_json', json);
          try { setAxes(JSON.parse(json)); } catch {}
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      }
    })();
  }, []);

  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)' }}
    >
      <DashboardHeader userName={userName} onNavigate={onNavigate} />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        {/* 상단 요약 */}
        <SkinSummary
          code={code}
          koAxisWord={koAxisWord}
          concerns={concerns}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
        />

        {/* 2열 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <PerfumeRecommendations
            selectedWeather={selectedWeather}
            setSelectedWeather={setSelectedWeather}
            selectedMood={selectedMood}
            setSelectedMood={setSelectedMood}
            perfumeRecommendations={perfumeRecommendations}
          />

          <BaumannAnalysis
            pick={pick}
            code={code}
            koAxisWord={koAxisWord}
            onNavigate={onNavigate}
          />

          {/* 시뮬레이터 */}
          <VirtualSkinModel skinType={baumannType} />

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
            onFetchRoutine={async () => {
              try {
                const data = await fetchRoutine(
                  baumannType,
                  season,
                  timeOfDay,
                  selectedKeywords
                );
                setRoutineProducts(data);
              } catch (err) {
                console.error('Failed to fetch routine:', err);
              }
            }}
          />
        </div>

        {/* ▼ 신규 섹션: 지금 뜨는 제품 랭킹 (두 카드 폭) */}
        <div className="mt-6">
          <TrendsSection />
        </div>
      </main>

      <DashboardBottomNav onNavigate={onNavigate} />
    </div>
  );
}
