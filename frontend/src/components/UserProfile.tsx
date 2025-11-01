'use client';

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
  MessageSquare,
  UserCircle,
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
  Heart,
} from 'lucide-react';
import { fetchUserProfile, updateUserProfile } from '../lib/utils';
import { API_BASE } from '../lib/env';

export interface UserProfileProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

type TabType = 'activity' | 'ingredients';

// 물방울 로더
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

// 비눗방울
const BubbleAnimation = () => {
  const bubbles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 3 + Math.random() * 2,
    size: 40 + Math.random() * 60,
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
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [newIngredient, setNewIngredient] = useState('');
  const [newIngredientType, setNewIngredientType] = useState<'preferred' | 'caution'>('preferred');

  const [userData, setUserData] = useState({
    id: 0,
    name: '',
    nickname: '',
    email: '',
    birthDate: '',
    gender: 'na',
    skinType: '',
  });

  useEffect(() => {
    const userIdStr = localStorage.getItem('user_id');
    const currentUserId = Number.parseInt(userIdStr || '0', 10);

    if (currentUserId === 0) {
      console.error('UserProfile: localStorage에서 user_id를 찾을 수 없습니다.');
      return;
    }

    setUserData(prev => ({ ...prev, id: currentUserId }));

    const loadData = async () => {
      try {
        const data = await fetchUserProfile(currentUserId);
        setUserData({
          id: data.id,
          name: data.name || '',
          nickname: data.nickname || '',
          email: data.email || '',
          birthDate: data.birthDate || '',
          gender: data.gender || 'na',
          skinType: data.skinType || '진단 필요',
        });
      } catch (error) {
        console.error('프로필 로드 실패:', error);
      }
    };

    loadData();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const updateData = {
        name: userData.name,
        email: userData.email,
        nickname: userData.nickname || userData.name,
        birthDate: userData.birthDate || null,
        gender: userData.gender || 'na',
        skinTypeCode: userData.skinType === '진단 필요' ? null : userData.skinType,
      };

      const updatedData = await updateUserProfile(userData.id, updateData);

      setUserData({
        id: updatedData.id,
        name: updatedData.name || '',
        nickname: updatedData.nickname || userData.name,
        email: updatedData.email || '',
        birthDate: updatedData.birthDate || '',
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

  const recentRecommendations: any[] = [];
  const recentIngredients: any[] = [];
  const favoriteProducts: any[] = [];
  const [preferredIngredients, setPreferredIngredients] = useState<any[]>([]);
  const [cautionIngredients, setCautionIngredients] = useState<any[]>([]);
  const handleAddIngredient = () => {};
  const removePreferredIngredient = (index: number) => {};
  const removeCautionIngredient = (index: number) => {};
  const getSeverityColor = (severity: string) => '';
  const getSeverityBadge = (severity: string) => '';

  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{
        background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)',
      }}
    >
      {isSaving && <BubbleAnimation />}

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
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
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
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-pink-100 text-pink-700 text-sm sm:text-base font-medium hover:bg-pink-200 transition-colors"
                >
                  {isSaving ? (
                    <WaterDropletLoader />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>변경사항 저장</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsEditing(false)}
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-pink-100 text-purple-700 text-sm sm:text-base font-medium hover:bg-pink-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>취소</span>
                </button>
              </div>
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

                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center">
                      <Calendar className="w-4 h-4 mr-2" /> 생년월일
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={userData.birthDate || ''}
                        onChange={e =>
                          setUserData({
                            ...userData,
                            birthDate: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                      />
                    ) : (
                      <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg">
                        {userData.birthDate || '(미입력)'}
                      </p>
                    )}
                  </div>

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

                  {/* ★ 여기 수정됨 */}
                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      피부 타입 (바우만)
                    </label>
                    <div className="flex flex-wrap gap-2 px-1 py-2 bg-gray-50 rounded-lg min-h-[44px] items-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={userData.skinType || ''}
                          readOnly
                          placeholder="예: OSNT"
                          maxLength={4}
                          className="w-18 px-3 py-1 text-purple-700 rounded-full text-md font-semibold focus:outline-none text-center cursor-default pointer-events-none select-none"
                        />
                      ) : (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-base font-semibold">
                          {userData.skinType || '진단 필요'}
                        </span>
                      )}

                      {isEditing && (
                        <button
                          onClick={() => onNavigate?.('diagnosis')}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-sm font-semibold sm:text-base font-small hover:bg-pink-200 transition-colors"
                        >
                          다시 진단
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-pink-100 z-50">
        <div className="flex items-center justify-around py-3">
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
