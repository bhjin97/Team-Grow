'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';

import DashboardHeader from './DashboardHeader';
import DashboardBottomNav from './DashboardBottomNav';

import SkinSummary from './SkinSummary';
import TrendsSection from './TrendsSection';

// 우측 카드(분포 + 모달 트리거)
import SkinTypeStatsPanel from './SkinTypeStatsPanel';

// 아이콘
import { TestTube2, Sparkles, ArrowRight, RefreshCcw } from 'lucide-react';

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

  const [baumannType, setBaumannType] = useState<string>(''); // ← 빈 문자열로 초기화
  const [axes, setAxes] = useState<AxesJSON | null>(null);
  const [userId, setUserId] = useState<number | undefined>(undefined);

  // --- 공용 필터(기간 항상 all) ---
  const [gender, setGender] = useState<Gender>('all');
  const [ageBand, setAgeBand] = useState<AgeBand>('all');

  // --- 축/라벨 계산 ---
  const code = (baumannType || 'ORNT').toUpperCase();
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
    return (['OD', 'SR', 'PN', 'WT'] as AxisKey[]).map(ax => {
      const axisData = axes?.[ax];
      const confidence = axisData?.confidence ? Math.round(axisData.confidence) : 50;
      const letter = axisData?.letter || '';
      
      // letter가 O/S/P/W면 왼쪽(value 그대로)
      // letter가 D/R/N/T면 오른쪽(100 - value)
      let value = confidence;
      if (ax === 'OD' && letter === 'D') value = 100 - confidence;
      if (ax === 'SR' && letter === 'R') value = 100 - confidence;
      if (ax === 'PN' && letter === 'N') value = 100 - confidence;
      if (ax === 'WT' && letter === 'T') value = 100 - confidence;
      
      return {
        key: ax,
        label: concernLabel[ax],
        value: value,
        displayValue: confidence, // ← 화면 표시용 (항상 원래 confidence)
      };
    });
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
        if (!res.ok) {
          // 404면 진단 안 한 상태
          setBaumannType('');
          return;
        }
        const data = await res.json();

        if (data?.skin_type_code) {
          const newType = String(data.skin_type_code);
          setBaumannType(newType);
          localStorage.setItem('skin_type_code', newType);
        } else {
          // skin_type_code 없으면 빈 문자열
          setBaumannType('');
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

  // ▼ 진단 필요 컴포넌트
  const DiagnosisNeeded = () => (
    <div className="relative flex flex-col items-center justify-center p-6 sm:p-8 text-center min-h-[400px] overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-pink-200/30 to-purple-200/30 blur-2xl top-4 left-4"></div>
        <div className="absolute w-24 h-24 rounded-full bg-gradient-to-br from-blue-200/30 to-pink-200/30 blur-xl bottom-8 right-8"></div>
        <div className="absolute w-40 h-40 rounded-full bg-gradient-to-br from-purple-200/20 to-pink-200/20 blur-3xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 w-full max-w-md">
        {/* 아이콘 */}
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-2xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center mb-5 shadow-lg transform hover:scale-105 transition-transform">
          <TestTube2 className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
        </div>
        
        {/* 제목 */}
        <h3 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
          피부타입 진단이 필요합니다
        </h3>
        
        {/* 부제 */}
        <p className="text-gray-500 text-sm mb-6">
          3분이면 당신의 피부를 완벽하게 이해할 수 있어요
        </p>

        {/* 이점 카드들 */}
        <div className="grid grid-cols-1 gap-3 mb-6">
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-pink-50 to-pink-100/50 rounded-xl border border-pink-200">
            <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-gray-800 text-sm">맞춤 제품 추천</p>
              <p className="text-xs text-gray-600">피부 타입에 딱 맞는 화장품</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-xl border border-purple-200">
            <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
              <RefreshCcw className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-gray-800 text-sm">개인화된 루틴</p>
              <p className="text-xs text-gray-600">계절/시간대별 스킨케어</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-blue-100/50 rounded-xl border border-blue-200">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <ArrowRight className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="font-bold text-gray-800 text-sm">정확한 AI 상담</p>
              <p className="text-xs text-gray-600">과학적 분석 기반 조언</p>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <button
          onClick={() => onNavigate?.('diagnosis')}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold text-white shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
          }}
        >
          <Sparkles className="w-5 h-5" />
          지금 진단하기
          <ArrowRight className="w-5 h-5" />
        </button>

        {/* 하단 안내 */}
        <p className="text-xs text-gray-400 mt-4">
          약 3~5분 소요 · 무료 · 언제든 다시 진단 가능
        </p>
      </div>
    </div>
  );

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
            {/* 좌측: SkinSummary 또는 진단 필요 */}
            <div className="p-4 sm:p-6 embed-card md:border-r md:border-gray-100">
              {baumannType ? (
                <SkinSummary
                  code={code}
                  koAxisWord={koAxisWord}
                  concerns={concerns}
                  selectedPeriod={selectedPeriod}
                  setSelectedPeriod={setSelectedPeriod}
                  variant="compact"
                />
              ) : (
                <DiagnosisNeeded />
              )}
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