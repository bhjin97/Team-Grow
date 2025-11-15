'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';

import DashboardHeader from './DashboardHeader';
import DashboardBottomNav from './DashboardBottomNav';

import SkinSummary from './SkinSummary';
import TrendsSection from './TrendsSection';

// 우측 카드(분포 + 모달 트리거)
import SkinTypeStatsPanel from './SkinTypeStatsPanel';

export interface DashboardProps {
  userName?: string;
  onNavigate?: (page: string) => void;
}

type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';
type AxisBrief = { avg: number; letter: string; confidence: number };
type AxesJSON = Record<AxisKey, AxisBrief>;

type Gender = 'all' | 'female' | 'male' | 'other' | 'na';
type AgeBand = 'all' | '10s' | '20s' | '30s' | '40s' | '50s' | '60s_plus';

export default function Dashboard({ userName = 'Sarah', onNavigate }: DashboardProps) {
  // --- 대시보드 상태 ---
  const [selectedPeriod, setSelectedPeriod] = useState('7days');

  const [baumannType, setBaumannType] = useState<string>('ORNT');
  const [axes, setAxes] = useState<AxesJSON | null>(null);
  const [userId, setUserId] = useState<number | undefined>(undefined);

  // --- 공용 필터(기간 항상 all) ---
  const [gender, setGender] = useState<Gender>('all');
  const [ageBand, setAgeBand] = useState<AgeBand>('all');

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

  // --- 프로필/축 로드 ---
  // 1) 최초 마운트: 캐시값 로드 + userId 상태 세팅
  useEffect(() => {
    try {
      const cachedType = localStorage.getItem('skin_type_code');
      const cachedAxes = localStorage.getItem('skin_axes_json');
      if (cachedType) setBaumannType(cachedType);
      if (cachedAxes) try { setAxes(JSON.parse(cachedAxes)); } catch {}

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
  }, [userId]);

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
      <DashboardHeader userName={userName} onNavigate={onNavigate} currentPage="dashboard" />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">

        {/* === 상단: 하나의 대형 카드(2열) === */}
        <section className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* 좌측: SkinSummary */}
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

            {/* 우측: 분포 패널 */}
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base sm:text-lg font-semibold">피부 타입 한눈에</h2>
                <FiltersBar />
              </div>
              <SkinTypeStatsPanel interval="all" gender={gender} ageBand={ageBand} framed={false} />
            </div>
          </div>
        </section>

        {/* ▼ 지금 뜨는 제품 랭킹 */}
        <div className="mt-6">
          <TrendsSection />
        </div>

      </main>

      <DashboardBottomNav onNavigate={onNavigate} currentPage="dashboard" />
    </div>
  );
}