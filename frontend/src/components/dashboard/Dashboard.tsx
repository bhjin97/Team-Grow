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

// 우측 카드(분포 + 모달 트리거)
import SkinTypeStatsPanel from './SkinTypeStatsPanel';

import { fetchRoutine } from '../../lib/utils';

type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';
type AxisBrief = { avg: number; letter: string; confidence: number };
type AxesJSON = Record<AxisKey, AxisBrief>;

export interface DashboardProps {
  userName?: string;
  onNavigate?: (page: string) => void;
}

type Gender = 'all' | 'female' | 'male' | 'other' | 'na';
type AgeBand = 'all' | '10s' | '20s' | '30s' | '40s' | '50s' | '60s_plus';

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

  // --- 공용 필터(기간 항상 all) ---
  const [gender, setGender] = useState<Gender>('all');
  const [ageBand, setAgeBand] = useState<AgeBand>('all');

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
  const [userChangedKeyword, setUserChangedKeyword] = useState(false);

  useEffect(() => {
    if (!userChangedKeyword) {
      const key = `${season}_${timeOfDay}`;
      const defaultKeywords = FOCUS_RULES[key] || [];
      setSelectedKeywords(defaultKeywords);
    }
  }, [season, timeOfDay]);

  const toggleKeyword = (kw: string) => {
    setUserChangedKeyword(true);
    if (selectedKeywords.includes(kw)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== kw));
    } else if (selectedKeywords.length < 2) {
      setSelectedKeywords([...selectedKeywords, kw]);
    }
  };

  const resetKeywords = () => {
    setSelectedKeywords([]);
    setUserChangedKeyword(false);
  };

  // --- 축/라벨 계산 ---
  const code = (baumannType ?? 'ORNT').toUpperCase();
  const pick = { OD: code[0], SR: code[1], PN: code[2], WT: code[3] } as const;
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

  // ▼ 공용 필터 바(기간 제거: 성별/연령대만)
  const FiltersBar = () => (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <label className="text-xs text-gray-500">성별</label>
      <select
        value={gender}
        onChange={(e) => setGender(e.target.value as Gender)}
        className="border rounded-md px-2 py-1 text-sm"
      >
        <option value="all">전체</option>
        <option value="female">여성</option>
        <option value="male">남성</option>
        <option value="other">기타</option>
        <option value="na">미응답</option>
      </select>

      <label className="text-xs text-gray-500 ml-2">연령대</label>
      <select
        value={ageBand}
        onChange={(e) => setAgeBand(e.target.value as AgeBand)}
        className="border rounded-md px-2 py-1 text-sm"
      >
        <option value="all">전체</option>
        <option value="10s">10대</option>
        <option value="20s">20대</option>
        <option value="30s">30대</option>
        <option value="40s">40대</option>
        <option value="50s">50대</option>
        <option value="60s_plus">60대+</option>
      </select>
    </div>
  );

  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)' }}
    >
      <DashboardHeader userName={userName} onNavigate={onNavigate} />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">

        {/* === 상단: 하나의 대형 카드(2열) === */}
        <section className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* 좌측: SkinSummary를 프레임 없이 보이도록 embed */}
            <div className="p-4 sm:p-6 embed-card md:border-r md:border-gray-100">
              <SkinSummary
                code={code}
                koAxisWord={koAxisWord}
                concerns={concerns}
                selectedPeriod={selectedPeriod}
                setSelectedPeriod={setSelectedPeriod}
                variant="compact"
              />
            </div>

            {/* 우측: 분포 패널(frameless) */}
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-semibold">사이트 피부 타입 분포</h2>
                <FiltersBar />
              </div>
              <SkinTypeStatsPanel interval="all" gender={gender} ageBand={ageBand} framed={false} />
            </div>
          </div>
        </section>

        {/* === 기존 2열 그리드 === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6">
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
            resetKeywords={resetKeywords}
          />
        </div>

        {/* ▼ 지금 뜨는 제품 랭킹 */}
        <div className="mt-6">
          <TrendsSection />
        </div>
      </main>

      <DashboardBottomNav onNavigate={onNavigate} />
    </div>
  );
}
