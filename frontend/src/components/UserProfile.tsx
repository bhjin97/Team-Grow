'use client';

// [★] useEffect, fetchUserProfile, updateUserProfile, Loader2 임포트
import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Mail,
  Calendar,
  Edit2,
  Save,
  Menu,
  X,
  Home,
  MessageSquare,
  UserCircle,
  Star,
  Clock,
  Bookmark,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  Camera,
  Settings as SettingsIcon,
  Bell,
  LayoutDashboard,
  TrendingUp,
  Loader2, // [★] 저장 로딩 아이콘
  Heart, // [★] 성별 아이콘 (선택)
} from 'lucide-react';
// [★] 경로 수정: ../lib/utils
import { fetchUserProfile, updateUserProfile } from '../lib/utils';
import { API_BASE } from '../lib/env';

export interface UserProfileProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

type TabType = 'activity' | 'ingredients';

// [★] "물방울" 로딩 효과 (CSS)
const WaterDropletLoader = () => (
  <>
    <style>{`
      @keyframes rise {
        0% { transform: translateY(0); opacity: 1; }
        50% { opacity: 0.8; }
        100% { transform: translateY(-20px); opacity: 0; }
      }
      .droplet {
        display: inline-block;
        width: 6px; height: 6px;
        background-color: white;
        border-radius: 50%;
        opacity: 0;
        animation: rise 1s ease-in-out infinite;
      }
    `}</style>
    <div className="flex justify-center items-center space-x-1 h-5">
      <span className="droplet" style={{ animationDelay: '0s' }}></span>
      <span className="droplet" style={{ animationDelay: '0.2s' }}></span>
      <span className="droplet" style={{ animationDelay: '0.4s' }}></span>
    </div>
  </>
);

// [★] 비눗방울 애니메이션 컴포넌트
const BubbleAnimation = () => {
  const bubbles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100, // 0-100% 랜덤 위치
    delay: Math.random() * 0.8, // 0-0.8초 랜덤 딜레이
    duration: 3 + Math.random() * 2, // 3-5초 랜덤 지속시간
    size: 40 + Math.random() * 60, // 40-100px 랜덤 크기
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {bubbles.map(bubble => (
        <motion.div
          key={bubble.id}
          className="absolute rounded-full"
          style={{
            left: `${bubble.left}%`,
            bottom: '-100px',
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            background:
              'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.9), rgba(248, 215, 230, 0.7), rgba(232, 180, 212, 0.5))',
            boxShadow:
              'inset -10px -10px 30px rgba(255, 255, 255, 0.8), inset 5px 5px 20px rgba(248, 215, 230, 0.5), 0 0 30px rgba(248, 215, 230, 0.4)',
            border: '3px solid rgba(255, 255, 255, 0.5)',
            backdropFilter: 'blur(2px)',
          }}
          animate={{
            y: [0, -1200],
            x: [0, (Math.random() - 0.5) * 150],
            opacity: [0, 1, 1, 0.8, 0],
            scale: [0.5, 1.2, 1, 1, 0.8],
          }}
          transition={{
            duration: bubble.duration,
            delay: bubble.delay,
            ease: [0.43, 0.13, 0.23, 0.96],
          }}
        />
      ))}
    </div>
  );
};

export default function UserProfile({ onNavigate, onLogout }: UserProfileProps) {
  // --- [★] 상태 관리 (isEditing, isSaving, userData 등) ---
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // [★] "물방울" 로딩 상태
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [newIngredient, setNewIngredient] = useState('');
  const [newIngredientType, setNewIngredientType] = useState<'preferred' | 'caution'>('preferred');

  // [★] DB 스키마에 맞춘 UserData 상태 (초기값은 공백)
  const [userData, setUserData] = useState({
    id: 0, // [★] 초기 ID 0으로 설정
    name: '', // users.name
    nickname: '', // user_profiles.nickname
    email: '', // users.email
    birthDate: '', // [★] 생년월일 (YYYY-MM-DD) - DATE 타입
    gender: 'na', // user_profiles.gender (na: Not Applicable/선택안함)
    skinType: '', // user_profiles.skin_type_code (OSNT 등)
  });

  // --- [★★★ 오류 수정 ★★★] ---
  // [★] 컴포넌트 로드 시 DB에서 프로필 데이터 1회 조회
  useEffect(() => {
    // [★] 'user_id'를 localStorage에서 동적으로 가져옵니다.
    const userIdStr = localStorage.getItem('user_id');

    // user_id가 없거나 숫자가 아니면 0 또는 기본값으로 설정 (오류 방지)
    const currentUserId = Number.parseInt(userIdStr || '0', 10);

    if (currentUserId === 0) {
      console.error('UserProfile: localStorage에서 user_id를 찾을 수 없습니다.');
      // (선택) 여기서 로그인 페이지로 리다이렉트할 수도 있습니다.
      return;
    }

    setUserData(prev => ({ ...prev, id: currentUserId })); // [★] 찾은 ID로 상태 설정

    const loadData = async () => {
      try {
        // [★] 동적으로 찾은 ID로 API 호출
        const data = await fetchUserProfile(currentUserId);
        setUserData({
          id: data.id,
          name: data.name || '',
          nickname: data.nickname || '',
          email: data.email || '',
          birthDate: data.birthDate || '', // [★] birthDate 전체 날짜
          gender: data.gender || 'na',
          skinType: data.skinType || '진단 필요',
        });
      } catch (error) {
        console.error('프로필 로드 실패:', error);
      }
    };

    loadData();
  }, []); // 빈 배열 = 마운트 시 1회 실행
  // --- [★★★ 수정 완료 ★★★] ---

  // [★] DB에 저장 (API 호출)
  const handleSave = async () => {
    setIsSaving(true);

    // [★] 비눗방울 애니메이션을 위해 최소 2초 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const updateData = {
        name: userData.name,
        email: userData.email,
        nickname: userData.nickname || userData.name, // [★] nickname 없으면 name 사용
        birthDate: userData.birthDate || null, // [★] 전체 생년월일 전송
        gender: userData.gender || 'na',
        skinTypeCode: userData.skinType === '진단 필요' ? null : userData.skinType,
      };

      const updatedData = await updateUserProfile(userData.id, updateData);

      setUserData({
        id: updatedData.id,
        name: updatedData.name || '',
        nickname: updatedData.nickname || userData.name, // [★] 닉네임 없으면 이름으로 설정
        email: updatedData.email || '',
        birthDate: updatedData.birthDate || '', // [★] 전체 생년월일
        gender: updatedData.gender || 'na',
        skinType: updatedData.skinType || '진단 필요',
      });

      setIsEditing(false);
    } catch (error) {
      console.error('프로필 저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- (나머지 '나의 활동', '성분 관리' 로직은 기존과 동일) ---
  const recentRecommendations = [
    /* ... */
  ];
  const recentIngredients = [
    /* ... */
  ];
  const favoriteProducts = [
    /* ... */
  ];
  const [preferredIngredients, setPreferredIngredients] = useState([
    /* ... */
  ]);
  const [cautionIngredients, setCautionIngredients] = useState([
    /* ... */
  ]);
  const handleAddIngredient = () => {
    /* ... */
  };
  const removePreferredIngredient = (index: number) => {
    /* ... */
  };
  const removeCautionIngredient = (index: number) => {
    /* ... */
  };
  const getSeverityColor = (severity: string) => {
    /* ... */
  };
  const getSeverityBadge = (severity: string) => {
    /* ... */
  };
  // --- (여기까지 동일) ---

  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{
        background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)',
      }}
    >
      {/* [★] 저장 중 비눗방울 애니메이션 */}
      {isSaving && <BubbleAnimation />}

      {/* Header (기존과 동일) */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-pink-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h1
                className="text-5xl sm:text-6xl font-light tracking-wide"
                style={{ fontFamily: "'Italianno', cursive", color: '#9b87f5' }}
              >
                aller
              </h1>
            </div>
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => onNavigate?.('dashboard')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <LayoutDashboard className="w-5 h-5" /> <span>대시보드</span>
              </button>
              <button
                onClick={() => onNavigate?.('chat')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <MessageSquare className="w-5 h-5" /> <span>AI 상담</span>
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                  color: 'white',
                }}
              >
                <UserCircle className="w-5 h-5" /> <span>프로필</span>
              </button>
              <button
                onClick={() => onNavigate?.('settings')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <SettingsIcon className="w-5 h-5" /> <span>설정</span>
              </button>
            </nav>
            <div className="hidden md:flex items-center space-x-4">
              <button className="p-2 text-gray-600 hover:text-pink-600 transition-colors relative">
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
              >
                {/* [★] 'Sarah' -> 'userData.nickname' (공백이면 이름, 이름도 공백이면 'U') */}
                {(userData.email || userData.name || 'U').charAt(0).toUpperCase()}
              </button>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-pink-600 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:hidden mt-4 pb-4 space-y-3"
            >
              {/* (모바일 메뉴 버튼들 ... 생략) */}
            </motion.div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        {/* 개인 정보 영역 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">개인 정보</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white hover:shadow-lg transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
              >
                <Edit2 className="w-4 h-4" /> <span>프로필 수정</span>
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm sm:text-base w-full sm:w-auto justify-center min-w-[140px] disabled:opacity-70"
              >
                {isSaving ? (
                  <WaterDropletLoader />
                ) : (
                  <>
                    {' '}
                    <Save className="w-4 h-4" /> <span>변경사항 저장</span>{' '}
                  </>
                )}
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center md:items-start">
                <div className="relative">
                  <div
                    className="w-32 h-32 rounded-full flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
                  >
                    <User className="w-16 h-16 text-white" />
                  </div>
                  {isEditing && (
                    <button className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-pink-600 hover:bg-pink-50 transition-colors">
                      <Camera className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={userData.email || ''}
                    onChange={e => setUserData({ ...userData, email: e.target.value })}
                    placeholder={`별명을 입력하세요 (비워두면 "${userData.email}"으로 설정됩니다)`}
                    className="mt-4 text-xl font-bold text-gray-800 text-center px-3 py-1 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
                  />
                ) : (
                  <h3 className="mt-4 text-xl font-bold text-gray-800">
                    {userData.email || userData.name || '(방문자)'}
                  </h3>
                )}
              </div>

              {/* 개인 정보 폼 */}
              <div className="flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      이름 (수정 불가)
                    </label>
                    <p className="text-sm text-gray-600 px-4 py-2 bg-gray-100 rounded-lg border border-gray-300">
                      {userData.name || '(미입력)'}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center">
                      <Mail className="w-4 h-4 mr-2" /> 이메일
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={userData.email || ''}
                        onChange={e => setUserData({ ...userData, email: e.target.value })}
                        placeholder="example@email.com"
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                      />
                    ) : (
                      <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg break-all">
                        {userData.email || '(미입력)'}
                      </p>
                    )}
                  </div>

                  {/* [★] 생년월일 (Birth Date) 수정 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center">
                      <Calendar className="w-4 h-4 mr-2" /> 생년월일
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={userData.birthDate || ''}
                        onChange={e => {
                          setUserData({
                            ...userData,
                            birthDate: e.target.value,
                          });
                        }}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                      />
                    ) : (
                      <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg">
                        {userData.birthDate || '(미입력)'}
                      </p>
                    )}
                  </div>

                  {/* [★] 성별 (Gender) 추가 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center">
                      <Heart className="w-4 h-4 mr-2" /> 성별
                    </label>
                    {isEditing ? (
                      <select
                        value={userData.gender || 'na'}
                        onChange={e => setUserData({ ...userData, gender: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
                      >
                        <option value="na">선택 안함</option>
                        <option value="female">여성</option>
                        <option value="male">남성</option>
                        <option value="other">기타</option>
                      </select>
                    ) : (
                      <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg">
                        {userData.gender === 'female'
                          ? '여성'
                          : userData.gender === 'male'
                            ? '남성'
                            : userData.gender === 'other'
                              ? '기타'
                              : '(미입력)'}
                      </p>
                    )}
                  </div>

                  {/* [★] 피부 타입 수정 */}
                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      피부 타입 (바우만)
                    </label>
                    <div className="flex flex-wrap gap-2 px-4 py-2 bg-gray-50 rounded-lg min-h-[44px] items-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={userData.skinType || ''}
                          onChange={e =>
                            setUserData({ ...userData, skinType: e.target.value.toUpperCase() })
                          }
                          placeholder="예: OSNT"
                          maxLength={4}
                          className="w-24 px-3 py-1 border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      ) : (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-base font-semibold">
                          {userData.skinType || '진단 필요'}
                        </span>
                      )}

                      {isEditing && (
                        <button
                          onClick={() => onNavigate?.('diagnosis')} // (가정) 진단 페이지로 이동
                          className="text-xs text-blue-600 hover:underline ml-2"
                        >
                          (피부 타입 재진단하기)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* --- (Tabs, Tab Content (나의 활동, 성분 관리)는 기존과 동일) --- */}
        <div className="bg-white rounded-t-2xl shadow-lg mb-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-semibold transition-colors ${activeTab === 'activity' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              나의 활동
            </button>
            <button
              onClick={() => setActiveTab('ingredients')}
              className={`flex-1 py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-semibold transition-colors ${activeTab === 'ingredients' ? 'text-pink-600 border-b-2 border-pink-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              성분 관리
            </button>
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-b-2xl shadow-lg p-4 sm:p-6"
        >
          {activeTab === 'activity' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* (나의 활동 UI ... 생략) */}
                <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <Clock className="w-5 h-5 text-purple-500 mr-2" />
                    최근 찾아본 성분
                  </h3>
                  <div className="space-y-3">
                    {recentIngredients.map((ingredient, index) => (
                      <div key={index} className="bg-white rounded-lg p-3 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-800 mb-1">
                          {ingredient.name}
                        </h4>
                        <p className="text-xs text-gray-600">{ingredient.effect}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <Bookmark className="w-5 h-5 text-blue-500 mr-2" />
                    즐겨찾기 제품
                  </h3>
                  <div className="space-y-3">
                    {favoriteProducts.map(product => (
                      <div key={product.id} className="bg-white rounded-lg p-3 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-800 mb-1">{product.name}</h4>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-600">{product.brand}</p>
                          <p className="text-xs font-bold text-pink-600">{product.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 text-pink-500 mr-2" />
                    최근 추천받은 제품
                  </h3>
                  <div className="space-y-3">
                    {recentRecommendations.map(recommendation => (
                      <div key={recommendation.id} className="bg-white rounded-lg p-3 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-800 mb-1">
                          {recommendation.productName}
                        </h4>
                        <p className="text-xs text-gray-500 mb-1">{recommendation.brand}</p>
                        <p className="text-xs text-gray-600">{recommendation.recommendedFor}</p>
                        <p className="text-xs text-gray-400 mt-2">{recommendation.date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* (성분 관리 UI ... 생략) */}
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-4 sm:p-6 border border-pink-200">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Plus className="w-5 h-5 text-pink-500 mr-2" />
                  성분 추가하기
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newIngredient}
                    onChange={e => setNewIngredient(e.target.value)}
                    placeholder="성분 이름을 입력하세요"
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  />
                  <select
                    value={newIngredientType}
                    onChange={e => setNewIngredientType(e.target.value as 'preferred' | 'caution')}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  >
                    <option value="preferred">선호 성분</option>
                    <option value="caution">주의 성분</option>
                  </select>
                  <button
                    onClick={handleAddIngredient}
                    className="px-6 py-2 rounded-lg text-white font-medium hover:shadow-lg transition-all text-sm"
                    style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
                  >
                    추가
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-green-50 rounded-xl p-4 sm:p-6 border border-green-200">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <Sparkles className="w-5 h-5 text-green-500 mr-2" />
                    선호 성분 ({preferredIngredients.length})
                  </h3>
                  <div className="space-y-3">
                    {preferredIngredients.map((ingredient, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="bg-white rounded-lg p-3 sm:p-4 border-2 border-green-200 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm sm:text-base font-bold text-gray-800 mb-1">
                              {ingredient.name}
                            </h4>
                            <p className="text-xs sm:text-sm text-gray-600">{ingredient.benefit}</p>
                          </div>
                          <button
                            onClick={() => removePreferredIngredient(index)}
                            className="ml-3 text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div className="bg-red-50 rounded-xl p-4 sm:p-6 border border-red-200">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                    주의 성분 ({cautionIngredients.length})
                  </h3>
                  <div className="space-y-3">
                    {cautionIngredients.map((ingredient, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className={`rounded-lg p-3 sm:p-4 border-2 hover:shadow-md transition-shadow ${getSeverityColor(ingredient.severity)}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h4 className="text-sm sm:text-base font-bold text-gray-800">
                                {ingredient.name}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${getSeverityBadge(ingredient.severity)}`}
                              >
                                {ingredient.severity}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm">{ingredient.reason}</p>
                          </div>
                          <button
                            onClick={() => removeCautionIngredient(index)}
                            className="ml-3 text-red-500 hover:text-red-700 transition-colors flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation (기존과 동일) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-pink-100 z-50">
        <div className="flex items-center justify-around px-4 py-3">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <LayoutDashboard className="w-6 h-6" /> <span className="text-xs">대시보드</span>
          </button>
          <button
            onClick={() => onNavigate?.('chat')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <MessageSquare className="w-6 h-6" /> <span className="text-xs">AI 상담</span>
          </button>
          <button
            onClick={() => onNavigate?.('profile')}
            className="flex flex-col items-center space-y-1 text-pink-600"
          >
            <UserCircle className="w-6 h-6" /> <span className="text-xs font-semibold">프로필</span>
          </button>
          <button
            onClick={() => onNavigate?.('settings')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <SettingsIcon className="w-6 h-6" /> <span className="text-xs">설정</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
