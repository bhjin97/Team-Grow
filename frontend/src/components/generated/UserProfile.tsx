'use client';

import * as React from 'react';
import { useState } from 'react';
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
} from 'lucide-react';
export interface UserProfileProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}
type TabType = 'activity' | 'ingredients';
export default function UserProfile({ onNavigate, onLogout }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [newIngredient, setNewIngredient] = useState('');
  const [newIngredientType, setNewIngredientType] = useState<'preferred' | 'caution'>('preferred');
  const [userData, setUserData] = useState({
    nickname: 'Sarah',
    fullName: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    birthday: '1995-05-15',
    skinConcerns: ['Dryness', 'Dark Spots', 'Fine Lines'],
  });

  // 나의 활동 데이터
  const recentRecommendations = [
    {
      id: 1,
      productName: 'Vitamin C Serum',
      brand: 'The Ordinary',
      recommendedFor: '브라이트닝, 다크스팟 개선',
      date: '2024-10-15',
    },
    {
      id: 2,
      productName: 'Hyaluronic Acid Cream',
      brand: 'Neutrogena',
      recommendedFor: '보습, 수분 공급',
      date: '2024-10-10',
    },
    {
      id: 3,
      productName: 'Gentle Face Wash',
      brand: 'CeraVe',
      recommendedFor: '민감성 피부 클렌징',
      date: '2024-10-05',
    },
  ];
  const recentIngredients = [
    {
      name: 'Niacinamide',
      effect: '브라이트닝, 피지 조절',
    },
    {
      name: 'Retinol',
      effect: '주름 개선, 피부 재생',
    },
    {
      name: 'Centella Asiatica',
      effect: '진정, 회복',
    },
  ];
  const favoriteProducts = [
    {
      id: 1,
      name: 'Vitamin C Serum',
      brand: 'Brand A',
      price: '$45',
    },
    {
      id: 2,
      name: 'Hyaluronic Moisturizer',
      brand: 'Brand B',
      price: '$38',
    },
    {
      id: 3,
      name: 'Gentle Cleanser',
      brand: 'Brand C',
      price: '$22',
    },
  ];

  // 성분 관리 데이터
  const [preferredIngredients, setPreferredIngredients] = useState([
    {
      name: 'Hyaluronic Acid',
      benefit: '강력한 보습 효과',
    },
    {
      name: 'Niacinamide',
      benefit: '피부톤 개선, 모공 축소',
    },
    {
      name: 'Vitamin C',
      benefit: '브라이트닝, 항산화',
    },
    {
      name: 'Ceramides',
      benefit: '피부 장벽 강화',
    },
    {
      name: 'Peptides',
      benefit: '탄력 개선, 주름 완화',
    },
  ]);
  const [cautionIngredients, setCautionIngredients] = useState([
    {
      name: 'Fragrance',
      reason: '피부 붉어짐과 자극 유발',
      severity: 'high' as const,
    },
    {
      name: 'Denatured Alcohol',
      reason: '과도한 건조 효과',
      severity: 'high' as const,
    },
    {
      name: 'Essential Oils',
      reason: '알러지 반응 가능성',
      severity: 'medium' as const,
    },
    {
      name: 'Coconut Oil',
      reason: '모공 막힘 유발',
      severity: 'medium' as const,
    },
  ]);
  const handleSave = () => {
    setIsEditing(false);
  };
  const handleAddIngredient = () => {
    if (newIngredient.trim() === '') return;
    if (newIngredientType === 'preferred') {
      setPreferredIngredients([
        ...preferredIngredients,
        {
          name: newIngredient,
          benefit: '사용자 추가 성분',
        },
      ]);
    } else {
      setCautionIngredients([
        ...cautionIngredients,
        {
          name: newIngredient,
          reason: '사용자 추가 성분',
          severity: 'medium',
        },
      ]);
    }
    setNewIngredient('');
  };
  const removePreferredIngredient = (index: number) => {
    setPreferredIngredients(preferredIngredients.filter((_, i) => i !== index));
  };
  const removeCautionIngredient = (index: number) => {
    setCautionIngredients(cautionIngredients.filter((_, i) => i !== index));
  };
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'low':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500 text-white';
      case 'medium':
        return 'bg-orange-500 text-white';
      case 'low':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
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
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
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
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                  color: 'white',
                }}
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
                {userData.nickname.charAt(0).toUpperCase()}
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
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
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
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-white font-semibold"
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
        {/* 개인 정보 영역 */}
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
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">개인 정보</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-white hover:shadow-lg transition-all text-sm sm:text-base w-full sm:w-auto justify-center"
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                }}
              >
                <Edit2 className="w-4 h-4" />
                <span>프로필 수정</span>
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
              >
                <Save className="w-4 h-4" />
                <span>변경사항 저장</span>
              </button>
            )}
          </div>

          {/* 통합 카드 */}
          <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-6">
              {/* 프로필 사진 */}
              <div className="flex flex-col items-center md:items-start">
                <div className="relative">
                  <div
                    className="w-32 h-32 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                    }}
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
                    value={userData.nickname}
                    onChange={e =>
                      setUserData({
                        ...userData,
                        nickname: e.target.value,
                      })
                    }
                    className="mt-4 text-xl font-bold text-gray-800 text-center px-3 py-1 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
                  />
                ) : (
                  <h3 className="mt-4 text-xl font-bold text-gray-800">{userData.nickname}</h3>
                )}
              </div>

              {/* 개인 정보 폼 */}
              <div className="flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 이름 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">이름</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={userData.fullName}
                        onChange={e =>
                          setUserData({
                            ...userData,
                            fullName: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                      />
                    ) : (
                      <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg">
                        {userData.fullName}
                      </p>
                    )}
                  </div>

                  {/* 이메일 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center">
                      <Mail className="w-4 h-4 mr-2" />
                      이메일
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={userData.email}
                        onChange={e =>
                          setUserData({
                            ...userData,
                            email: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                      />
                    ) : (
                      <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg break-all">
                        {userData.email}
                      </p>
                    )}
                  </div>

                  {/* 생년월일 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      생년월일
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={userData.birthday}
                        onChange={e =>
                          setUserData({
                            ...userData,
                            birthday: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                      />
                    ) : (
                      <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg">
                        {new Date(userData.birthday).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    )}
                  </div>

                  {/* 피부 고민 */}
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      피부 고민
                    </label>
                    <div className="flex flex-wrap gap-2 px-4 py-2 bg-gray-50 rounded-lg min-h-[44px] items-center">
                      {userData.skinConcerns.map((concern, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-xs font-medium"
                        >
                          {concern}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
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

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.3,
          }}
          className="bg-white rounded-b-2xl shadow-lg p-4 sm:p-6"
        >
          {activeTab === 'activity' ? (
            <div className="space-y-6">
              {/* 1행 3열 배치 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* 최근 찾아본 성분 */}
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

                {/* 즐겨찾기 제품 */}
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

                {/* 최근 추천받은 제품 */}
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
              {/* 성분 추가 섹션 */}
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
                    style={{
                      background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                    }}
                  >
                    추가
                  </button>
                </div>
              </div>

              {/* 1행 2열 배치 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* 선호 성분 */}
                <div className="bg-green-50 rounded-xl p-4 sm:p-6 border border-green-200">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <Sparkles className="w-5 h-5 text-green-500 mr-2" />
                    선호 성분 ({preferredIngredients.length})
                  </h3>
                  <div className="space-y-3">
                    {preferredIngredients.map((ingredient, index) => (
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
                          duration: 0.3,
                          delay: index * 0.05,
                        }}
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

                {/* 주의 성분 */}
                <div className="bg-red-50 rounded-xl p-4 sm:p-6 border border-red-200">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                    주의 성분 ({cautionIngredients.length})
                  </h3>
                  <div className="space-y-3">
                    {cautionIngredients.map((ingredient, index) => (
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
                          duration: 0.3,
                          delay: index * 0.05,
                        }}
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

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-pink-100 z-50">
        <div className="flex items-center justify-around px-4 py-3">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xs">대시보드</span>
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
            className="flex flex-col items-center space-y-1 text-pink-600"
          >
            <UserCircle className="w-6 h-6" />
            <span className="text-xs font-semibold">프로필</span>
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
