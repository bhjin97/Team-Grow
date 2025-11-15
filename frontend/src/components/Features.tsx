'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import FeaturesUI from './FeaturesUI';
import { fetchRoutine } from '@/lib/utils';

type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';
type AxisBrief = { avg: number; letter: string; confidence: number };
type AxesJSON = Record<AxisKey, AxisBrief>;

export interface FeaturesProps {
  userName?: string;
  onNavigate?: (page: string) => void;
  currentPage?: string;
}

export default function Features({ userName = 'Sarah', onNavigate, currentPage = 'features' }: FeaturesProps) {
  // === 피부 타입 상태 ===
  const [baumannType, setBaumannType] = useState<string>('ORNT');
  const [axes, setAxes] = useState<AxesJSON | null>(null);
  const [userId, setUserId] = useState<number | undefined>(undefined);

  // === 향수 추천 상태 ===
  const [selectedWeather, setSelectedWeather] = useState('sunny');
  const [selectedMood, setSelectedMood] = useState('fresh');

  // === 맞춤 루틴 상태 ===
  const [season, setSeason] = useState('summer');
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [routineProducts, setRoutineProducts] = useState<any[]>([]);

  // 키워드 룰
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

  // === 축/라벨 계산 ===
  const code = (baumannType ?? 'ORNT').toUpperCase();
  const pick = { OD: code[0], SR: code[1], PN: code[2], WT: code[3] } as const;
  const koAxisWord = {
    OD: pick.OD === 'O' ? '지성' : '건성',
    SR: pick.SR === 'R' ? '저항성' : '민감성',
    PN: pick.PN === 'N' ? '비색소침착' : '색소침착',
    WT: pick.WT === 'T' ? '탱탱함' : '주름',
  };

  const perfumeRecommendations = [
    { name: 'Fresh Citrus', notes: 'Bergamot, Lemon, White Tea', match: '95%' },
    { name: 'Spring Garden', notes: 'Jasmine, Rose, Green Leaves', match: '88%' },
    { name: 'Ocean Breeze', notes: 'Sea Salt, Mint, Amber', match: '82%' },
  ];

  // === 프로필/축 로드 ===
  // 1) 최초 마운트: 캐시값 로드 + userId 상태 세팅
  useEffect(() => {
    try {
      const cachedType = localStorage.getItem('skin_type_code');
      const cachedAxes = localStorage.getItem('skin_axes_json');
      if (cachedType) setBaumannType(cachedType);
      if (cachedAxes) {
        try {
          setAxes(JSON.parse(cachedAxes));
        } catch {}
      }

      const userIdStr = localStorage.getItem('user_id') ?? '1';
      const id = Number.parseInt(userIdStr, 10);
      setUserId(Number.isFinite(id) ? id : 1);
    } catch (e) {
      setUserId(1);
    }
  }, []);

  // 2) userId가 준비되면 프로필 fetch
  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const base = (await import('@/lib/env')).API_BASE;
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
          const json =
            typeof data.skin_axes_json === 'string'
              ? data.skin_axes_json
              : JSON.stringify(data.skin_axes_json);
          localStorage.setItem('skin_axes_json', json);
          try {
            setAxes(JSON.parse(json));
          } catch {}
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      }
    })();
  }, [userId]);

  const handleFetchRoutine = async () => {
    try {
      const data = await fetchRoutine(baumannType, season, timeOfDay, selectedKeywords);
      setRoutineProducts(data);
    } catch (err) {
      console.error('Failed to fetch routine:', err);
    }
  };

  return (
    <FeaturesUI
      userName={userName}
      onNavigate={onNavigate}
      currentPage={currentPage}
      baumannType={baumannType}
      setBaumannType={setBaumannType}
      userId={userId}
      pick={pick}
      code={code}
      koAxisWord={koAxisWord}
      selectedWeather={selectedWeather}
      setSelectedWeather={setSelectedWeather}
      selectedMood={selectedMood}
      setSelectedMood={setSelectedMood}
      perfumeRecommendations={perfumeRecommendations}
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
      onFetchRoutine={handleFetchRoutine}
      resetKeywords={resetKeywords}
    />
  );
}