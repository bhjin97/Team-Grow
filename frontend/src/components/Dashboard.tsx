'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Menu,
  X,
  Droplets,
  Sparkles,
  LineChart,
  Camera,
  Clock,
  MessageSquare,
  UserCircle,
  Settings as SettingsIcon,
  LayoutDashboard,
  Bell,
  RefreshCcw,
} from 'lucide-react';
import { fetchRoutine } from '../../lib/utils'; 
// import { API_BASE } from '../../lib/env';

// ─────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────
type AxisKey = 'OD' | 'SR' | 'PN' | 'WT';
type AxisBrief = { avg: number; letter: string; confidence: number };
type AxesJSON = Record<AxisKey, AxisBrief>;

export interface DashboardProps {
  userName?: string;
  onNavigate?: (page: string) => void;
}

export default function Dashboard({ userName = 'Sarah', onNavigate }: DashboardProps) {
  // ─────────────────────────────────────────
  // 은영 쪽 상태
  // ─────────────────────────────────────────
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedWeather, setSelectedWeather] = useState('sunny');
  const [selectedMood, setSelectedMood] = useState('fresh');
  const [season, setSeason] = useState('summer');
  const [timeOfDay, setTimeOfDay] = useState('morning');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [routineProducts, setRoutineProducts] = useState<any[]>([]);

  // ─────────────────────────────────────────
  // 바우만 타입/축 동기화
  // ─────────────────────────────────────────
  const [baumannType, setBaumannType] = useState<string>('ORNT');
  const [axes, setAxes] = useState<AxesJSON | null>(null);

  // ─────────────────────────────────────────
  // “계절+시간대”에 따라 키워드 자동 세팅
  // ─────────────────────────────────────────
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

  useEffect(() => {
    const defaultKeywords = FOCUS_RULES[`${season}_${timeOfDay}`] || [];
    setSelectedKeywords(defaultKeywords);
  }, [season, timeOfDay]);

  const toggleKeyword = (kw: string) => {
    if (selectedKeywords.includes(kw)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== kw));
    } else {
      if (selectedKeywords.length < 2) {
        setSelectedKeywords([...selectedKeywords, kw]);
      }
    }
  };

  // ─────────────────────────────────────────
  // 진단 결과 동기화
  // ─────────────────────────────────────────
  useEffect(() => {
    // 1) localStorage 먼저
    const cachedType =
      typeof window !== 'undefined' ? localStorage.getItem('skin_type_code') : null;
    const cachedAxes =
      typeof window !== 'undefined' ? localStorage.getItem('skin_axes_json') : null;
    if (cachedType) setBaumannType(cachedType);
    if (cachedAxes) {
      try {
        setAxes(JSON.parse(cachedAxes));
      } catch {}
    }

    // 2) 서버에서 다시 가져오기
    const userIdStr = (typeof window !== 'undefined' && localStorage.getItem('user_id')) ?? '1';
    const userId = Number.parseInt(userIdStr, 10) || 1;

    (async () => {
      try {
        if (!API_BASE) return;
        const res = await fetch(`${API_BASE}/api/profile/${userId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.skin_type_code) {
          setBaumannType(String(data.skin_type_code));
          if (typeof window !== 'undefined') {
            localStorage.setItem('skin_type_code', String(data.skin_type_code));
          }
        }
        if (data?.skin_axes_json) {
          const json =
            typeof data.skin_axes_json === 'string'
              ? data.skin_axes_json
              : JSON.stringify(data.skin_axes_json);
          if (typeof window !== 'undefined') {
            localStorage.setItem('skin_axes_json', json);
          }
          try {
            setAxes(JSON.parse(json));
          } catch {}
        }
      } catch {
        // 서버 없으면 조용히 무시
      }
    })();

    // 3) storage 이벤트로 다른 탭 변경도 반영
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'skin_type_code' && e.newValue) setBaumannType(e.newValue);
      if (e.key === 'skin_axes_json' && e.newValue) {
        try {
          setAxes(JSON.parse(e.newValue));
        } catch {}
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
    };
  }, []);

  // ─────────────────────────────────────────
  // 바우만 코드 파싱
  // ─────────────────────────────────────────
  const code = (baumannType ?? 'ORNT').toUpperCase();
  const pick = {
    OD: code[0], // O | D
    SR: code[1], // S | R
    PN: code[2], // P | N
    WT: code[3], // W | T
  };

  const koAxisWord = {
    OD: pick.OD === 'O' ? '지성' : '건성',
    SR: pick.SR === 'R' ? '저항성' : '민감성',
    PN: pick.PN === 'N' ? '비색소침착' : '색소침착',
    WT: pick.WT === 'T' ? '탱탱함' : '주름',
  };

  // 축 기반 “주요 피부 고민” 만들기
  const concernLabel: Record<AxisKey, string> = {
    OD: pick.OD === 'O' ? 'OILY' : 'DRY',
    SR: pick.SR === 'R' ? 'RESISTANCE' : 'SENSITIVE',
    PN: pick.PN === 'N' ? 'NON-PIGMENTED' : 'PIGMENTED',
    WT: pick.WT === 'T' ? 'TIGHT' : 'WRINKLED',
  };
  const concerns = useMemo(() => {
    const list = (['OD', 'SR', 'PN', 'WT'] as AxisKey[]).map(ax => ({
      key: ax,
      label: concernLabel[ax],
      value: axes?.[ax]?.confidence ? Math.round(axes![ax].confidence) : 0,
    }));
    return list;
  }, [axes, baumannType]);

  const topIdx = useMemo(() => {
    if (!concerns.length) return 0;
    return concerns.map(c => c.value).reduce((best, v, i, arr) => (v > arr[best] ? i : best), 0);
  }, [concerns]);

  // ─────────────────────────────────────────
  // 향수 추천 더미
  // ─────────────────────────────────────────
  const perfumeRecommendations = [
    {
      name: 'Fresh Citrus',
      notes: 'Bergamot, Lemon, White Tea',
      match: '95%',
    },
    {
      name: 'Spring Garden',
      notes: 'Jasmine, Rose, Green Leaves',
      match: '88%',
    },
    {
      name: 'Ocean Breeze',
      notes: 'Sea Salt, Mint, Amber',
      match: '82%',
    },
  ];

  // ─────────────────────────────────────────
  // 공용 pill
  // ─────────────────────────────────────────
  const pill = (active: boolean, tone: 'blue' | 'pink' | 'purple' | 'amber', label: string) => {
    const act = {
      blue: 'bg-blue-500 text-white border-blue-500',
      pink: 'bg-pink-500 text-white border-pink-500',
      purple: 'bg-purple-500 text-white border-purple-500',
      amber: 'bg-amber-500 text-white border-amber-500',
    } as const;
    return (
      <span
        className={[
          'px-3 py-1.5 rounded-lg text-sm font-medium border',
          active ? act[tone] : 'bg-white text-gray-700 border-gray-200',
        ].join(' ')}
      >
        {label}
      </span>
    );
  };

  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{
        background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)',
      }}
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-pink-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center space-x-2">
              <h1
                className="text-5xl sm:text-6xl font-light tracking-wide"
                style={{
                  fontFamily: "'Italianno', cursive",
                  color: '#9b87f5',
                }}
              >
                aller
              </h1>
            </div>

            {/* Center: Navigation (Hidden on mobile) */}
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => onNavigate?.('dashboard')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                  color: 'white',
                }}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>대시보드</span>
              </button>
              <button
                onClick={() => onNavigate?.('chat')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                <span>AI 상담</span>
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <UserCircle className="w-5 h-5" />
                <span>프로필</span>
              </button>
              <button
                onClick={() => onNavigate?.('settings')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <SettingsIcon className="w-5 h-5" />
                <span>설정</span>
              </button>
            </nav>

            {/* Right: Notifications & Profile (Hidden on mobile) */}
            <div className="hidden md:flex items-center space-x-4">
              <button className="p-2 text-gray-600 hover:text-pink-600 transition-colors relative">
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-pink-600 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <motion.div
              initial={{
                opacity: 0,
                y: -10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="md:hidden mt-4 pb-4 space-y-3"
            >
              <button
                onClick={() => {
                  onNavigate?.('dashboard');
                  setMobileMenuOpen(false);
                }}
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-white font-semibold"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>대시보드</span>
              </button>
              <button
                onClick={() => {
                  onNavigate?.('chat');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
              >
                <MessageSquare className="w-5 h-5" />
                <span>AI 상담</span>
              </button>
              <button
                onClick={() => {
                  onNavigate?.('profile');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
              >
                <UserCircle className="w-5 h-5" />
                <span>프로필</span>
              </button>
              <button
                onClick={() => {
                  onNavigate?.('settings');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
              >
                <SettingsIcon className="w-5 h-5" />
                <span>설정</span>
              </button>
            </motion.div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
          }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1 sm:mb-2">
            환영합니다, {userName}님! 🌸
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-8">
            당신을 위한 맞춤 뷰티 정보입니다
          </p>
        </motion.div>

        {/* 1. Skin Summary - Full Width */}
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
            delay: 0.1,
          }}
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
                  initial={{
                    width: 0,
                  }}
                  animate={{
                    width: '95%',
                  }}
                  transition={{
                    duration: 1,
                    delay: 0.3,
                  }}
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

            {/* Top Concerns Section*/}
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
                        initial={{
                          width: 0,
                        }}
                        animate={{
                          width: `${item.value}%`,
                        }}
                        transition={{
                          duration: 0.8,
                          delay: 0.4 + index * 0.1,
                        }}
                        className="bg-gradient-to-r from-purple-300 to-pink-300 h-2 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* 2-5: Grid Layout - 2x2 on desktop, 1 column on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* 2. Perfume Recommendations */}
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.2,
            }}
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
                  initial={{
                    opacity: 0,
                    x: -20,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                  }}
                  transition={{
                    duration: 0.4,
                    delay: 0.5 + index * 0.1,
                  }}
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

          {/* 3. Baumann Skin Type Test*/}
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.3,
            }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
              <LineChart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mr-2" />
              바우만 피부 분석
            </h3>

            <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
              16가지 과학적 분류 기반 당신의 고유한 피부 타입을 발견하세요
            </p>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="p-2 sm:p-3 rounded-xl bg-blue-50 border-2 border-blue-200">
                <div className="text-center mb-2">
                  <span className="text-xs sm:text-sm font-semibold text-gray-700">수분</span>
                </div>
                <div className="flex justify-center space-x-1 sm:space-x-2">
                  {pill(pick.OD === 'D', 'blue', '건성')}
                  {pill(pick.OD === 'O', 'blue', '지성')}
                </div>
              </div>

              <div className="p-2 sm:p-3 rounded-xl bg-pink-50 border-2 border-pink-200">
                <div className="text-center mb-2">
                  <span className="text-xs sm:text-sm font-semibold text-gray-700">민감도</span>
                </div>
                <div className="flex justify-center space-x-1 sm:space-x-2">
                  {pill(pick.SR !== 'R', 'pink', '민감성')}
                  {pill(pick.SR === 'R', 'pink', '저항성')}
                </div>
              </div>

              <div className="p-2 sm:p-3 rounded-xl bg-purple-50 border-2 border-purple-200">
                <div className="text-center mb-2">
                  <span className="text-xs sm:text-sm font-semibold text-gray-700">색소침착</span>
                </div>
                <div className="flex justify-center space-x-1 sm:space-x-2">
                  {pill(pick.PN === 'P', 'purple', '색소침착')}
                  {pill(pick.PN === 'N', 'purple', '비색소')}
                </div>
              </div>

              <div className="p-2 sm:p-3 rounded-xl bg-amber-50 border-2 border-amber-200">
                <div className="text-center mb-2">
                  <span className="text-xs sm:text-sm font-semibold text-gray-700">주름</span>
                </div>
                <div className="flex justify-center space-x-1 sm:space-x-2">
                  {pill(pick.WT === 'W', 'amber', '주름')}
                  {pill(pick.WT === 'T', 'amber', '탄력')}
                </div>
              </div>
            </div>

            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-purple-100 rounded-xl flex items-center justify-between gap-3">
              <p className="text-xs sm:text-sm">
                <span className="font-semibold text-purple-700">당신의 타입: {code}</span>
                <span className="text-gray-600 block sm:inline sm:ml-2 mt-1 sm:mt-0">
                  ({koAxisWord.OD}, {koAxisWord.SR}, {koAxisWord.PN}, {koAxisWord.WT})
                </span>
              </p>
              <button
                onClick={() => onNavigate?.('diagnosis')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs sm:text-sm border border-purple-200 text-purple-700 hover:bg-purple-50"
              >
                <RefreshCcw className="w-4 h-4" /> 다시 진단
              </button>
            </div>
          </motion.div>

          {/* 4. Virtual Skin Model */}
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.4,
            }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
              <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 mr-2" />
              가상 피부 시뮬레이션
            </h3>

            <div className="aspect-square bg-purple-100 rounded-xl mb-3 sm:mb-4 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-40 sm:w-40 sm:h-52 bg-purple-200 rounded-full opacity-80" />
              </div>
              <span className="relative z-10 text-sm sm:text-base text-gray-500 font-medium">
                얼굴 모델 미리보기
              </span>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <button
                className="w-full py-2.5 sm:py-3 rounded-xl font-medium text-white shadow-md hover:shadow-lg transition-all text-sm sm:text-base"
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                }}
              >
                제품 효과 시뮬레이션
              </button>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button className="py-2 rounded-lg border-2 border-pink-200 text-pink-600 text-sm sm:text-base font-medium hover:bg-pink-50 transition-colors">
                  사용 전
                </button>
                <button className="py-2 rounded-lg border-2 border-pink-200 text-pink-600 text-sm sm:text-base font-medium hover:bg-pink-50 transition-colors">
                  사용 후 (30일)
                </button>
              </div>
            </div>
          </motion.div>

          {/* 5. Custom Routine */}
          <motion.div
            initial={{
              opacity: 0,
              y: 20,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={{
              duration: 0.5,
              delay: 0.5,
            }}
            className="bg-white rounded-2xl shadow-lg p-4 sm:p-6"
          >
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 sm:mb-4 flex items-center">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500 mr-2" />
              맞춤 케어 루틴
            </h3>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">계절</label>
                <select
                  value={season}
                  onChange={e => setSeason(e.target.value)}
                  className="w-full px-1.5 sm:px-2 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="summer">☀️ 여름</option>
                  <option value="winter">❄️ 겨울</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">시간</label>
                <select
                  value={timeOfDay}
                  onChange={e => setTimeOfDay(e.target.value)}
                  className="w-full px-1.5 sm:px-2 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                >
                  <option value="morning">🌅 오전</option>
                  <option value="evening">🌙 오후</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">피부 타입</label>
                <select
                  value={baumannType}
                  onChange={e => setBaumannType(e.target.value)}
                  className="w-full px-1.5 sm:px-2 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <option value="DRNT">DRNT</option>
                  <option value="DRNW">DRNW</option>
                  <option value="DRPT">DRPT</option>
                  <option value="DRPW">DRPW</option>
                  <option value="DSPT">DSPT</option>
                  <option value="DSPW">DSPW</option>
                  <option value="DSNT">DSNT</option>
                  <option value="DSNW">DSNW</option>
                  <option value="ORNT">ORNT</option>
                  <option value="ORNW">ORNW</option>
                  <option value="ORPT">ORPT</option>
                  <option value="ORPW">ORPW</option>
                  <option value="OSPT">OSPT</option>
                  <option value="OSPW">OSPW</option>
                  <option value="OSNT">OSNT</option>
                  <option value="OSNW">OSNW</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-600 mb-1 block">키워드 선택 (최대 2개)</label>
              <div className="flex flex-wrap gap-2 items-center mb-4">
                {allKeywordOptions.map(kw => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => toggleKeyword(kw)}
                    className={`px-2 py-1 rounded-full text-xs sm:text-sm border 
                      ${
                        selectedKeywords.includes(kw)
                          ? 'bg-pink-200 border-pink-400 text-pink-700 font-semibold'
                          : 'bg-gray-100 border-gray-300 text-gray-600'
                      }`}
                  >
                    #{kw}
                  </button>
                ))}

                {/* 초기화 버튼 */}
                <button
                  type="button"
                  onClick={() => setSelectedKeywords([])}
                  className="px-3 py-1 rounded-full text-xs sm:text-sm bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  초기화
                </button>
              </div>
            </div>

            {/* Horizontal Product Cards with Images */}
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3 sm:gap-4 min-w-max">
                {routineProducts.map((product, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
                    className="flex-shrink-0 w-40 sm:w-48 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border-2 border-pink-100 hover:shadow-lg transition-shadow"
                  >
                    {/* Step (카테고리) */}
                    <div className="text-xs sm:text-sm font-semibold text-pink-600 mb-1">
                      {product.step}
                    </div>

                    {/* Product Image */}
                    <div className="w-full aspect-square bg-white rounded-lg mb-2 flex items-center justify-center">
                      <img
                        src={product.image_url}
                        alt={product.display_name}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    </div>

                    {/* Product Info */}
                    <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
                      {product.display_name}
                    </p>
                    <p className="text-[11px] text-gray-500">{product.reason}</p>
                  </motion.div>
                ))}
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const data = await fetchRoutine(
                    baumannType,
                    season,
                    timeOfDay,
                    selectedKeywords
                  );
                  setRoutineProducts(data);
                } catch (err) {
                  console.error(err);
                }
              }}
              className="w-full mt-3 sm:mt-4 py-2.5 sm:py-3 rounded-xl bg-pink-100 text-pink-700 text-sm sm:text-base font-medium hover:bg-pink-200 transition-colors"
            >
              스킨케어 루틴 추천 받기
            </button>
          </motion.div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-pink-100 z-50">
        <div className="flex items-center justify-around px-4 py-3">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex flex-col items-center space-y-1 text-pink-600"
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xs font-semibold">대시보드</span>
          </button>
          <button
            onClick={() => onNavigate?.('chat')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-xs">AI 상담</span>
          </button>
          <button
            onClick={() => onNavigate?.('profile')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <UserCircle className="w-6 h-6" />
            <span className="text-xs">프로필</span>
          </button>
          <button
            onClick={() => onNavigate?.('settings')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <SettingsIcon className="w-6 h-6" />
            <span className="text-xs">설정</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
