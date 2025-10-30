'use client';

// [★] useEffect, useState, useMemo만 필요
import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import DashboardHeader from './DashboardHeader';
import DashboardBottomNav from './DashboardBottomNav';

import SkinSummary from './SkinSummary';
import PerfumeRecommendations from './PerfumeRecommendations';
import BaumannAnalysis from './BaumannAnalysis';
import VirtualSkinModel from './VirtualSkinModel';
import CustomRoutine from './CustomRoutine';

// [★] 'fetchSimulation'은 VirtualSkinModel로 이동
import { fetchRoutine } from '../../lib/utils'; 
import { API_BASE } from '../../lib/env'; 


type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';
type AxisBrief = { avg: number; letter: string; confidence: number };
type AxesJSON = Record<AxisKey, AxisBrief>;

// [★] AnalysisResult 타입 제거 (VirtualSkinModel로 이동)

export interface DashboardProps {
  userName?: string;
  onNavigate?: (page: string) => void;
}

export default function Dashboard({ userName = 'Sarah', onNavigate }: DashboardProps) {
  // --- 기존 상태 ---
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedWeather, setSelectedWeather] = useState('sunny');
  const [selectedMood, setSelectedMood] = useState('fresh');
  const [season, setSeason] = useState('summer');
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [baumannType, setBaumannType] = useState<string>('ORNT'); // [★] 이 상태는 공유되므로 유지
  const [axes, setAxes] = useState<AxesJSON | null>(null);
  const [routineProducts, setRoutineProducts] = useState<any[]>([]);
  
  // --- [★] VirtualSkinModel 관련 상태 4개 모두 제거 ---
  // const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  // const [isSimLoading, setIsSimLoading] = useState(false);
  // const [simError, setSimError] = useState<string | null>(null);
  // const [selectedProduct, setSelectedProduct] = useState('');
  // const [showFullReport, setShowFullReport] = useState(false);
  // --- [★] --------------------------------------- ---

  // --- 기존 로직들 (FOCUS_RULES, toggleKeyword, code, pick 등) ---
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
  // --- 기존 로직 끝 ---


  // [★] 서버에서 피부 타입/축 가져오는 로직 (유지)
  useEffect(() => {
    // 1) localStorage 먼저
    const cachedType = localStorage.getItem('skin_type_code');
    const cachedAxes = localStorage.getItem('skin_axes_json');
    if (cachedType) setBaumannType(cachedType);
    if (cachedAxes) try { setAxes(JSON.parse(cachedAxes)); } catch {}

    // 2) 서버에서 다시 가져오기 (User ID 하드코딩)
    const userIdStr = localStorage.getItem('user_id') ?? '1';
    const userId = Number.parseInt(userIdStr, 10) || 1;

    (async () => {
      try {
        if (!API_BASE) {
          console.warn("API_BASE is not defined, skipping profile fetch.");
          return;
        }
        const res = await fetch(`${API_BASE}/api/profile/${userId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.skin_type_code) {
          const newType = String(data.skin_type_code);
          setBaumannType(newType);
          localStorage.setItem('skin_type_code', newType);
        }
        if (data?.skin_axes_json) {
          const json = typeof data.skin_axes_json === 'string' ? data.skin_axes_json : JSON.stringify(data.skin_axes_json);
          localStorage.setItem('skin_axes_json', json);
          try { setAxes(JSON.parse(json)); } catch {}
        }
      } catch (err) {
        console.error("Failed to fetch profile (server might be down):", err);
      }
    })();
  }, []);

  // --- [★] handleSimulation 함수 제거 (VirtualSkinModel로 이동) ---

  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)' }}
    >
      <DashboardHeader userName={userName} onNavigate={onNavigate} />

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
          <BaumannAnalysis
            pick={pick}
            code={code}
            koAxisWord={koAxisWord}
            onNavigate={onNavigate}
          />
          
          {/* --- [★] VirtualSkinModel에 skinType만 전달 --- */}
          <VirtualSkinModel
            skinType={baumannType}
          />

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
            
            // fetchRoutine을 위한 핸들러
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
                console.error("Failed to fetch routine:", err);
              }
            }}
          />
        </div>
      </main>

      <DashboardBottomNav onNavigate={onNavigate} />
      
      {/* --- [★] 전체보기 모달 제거 (VirtualSkinModel로 이동) --- */}
      
    </div>
  );
}