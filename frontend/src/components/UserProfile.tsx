'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Search as SearchIcon,
} from 'lucide-react';
import { API_BASE } from '../lib/env';
import { fetchUserProfile, updateUserProfile } from '../lib/utils';
import { useUserStore } from '@/stores/auth/store';
import ProductDetailModal from './dashboard/ProductDetailModal';
import DashboardHeader from './dashboard/DashboardHeader';
import DashboardBottomNav from './dashboard/DashboardBottomNav';

export interface UserProfileProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
  currentPage?: string;  // ← 추가
}

type TabType = 'activity' | 'ingredients';

type Ingredient = {
  id: number;
  korean_name: string;
  english_name?: string | null;
  description?: string | null;
  caution_grade?: string | null; // '주의', '고위험' 등
};

type PreferredItem = { id: number; name: string; benefit: string };
type CautionItem = { id: number; name: string; reason: string; severity: 'low' | 'mid' | 'high' };

const WaterDropletLoader = () => (
  <>
    <style>{`
      @keyframes rise { 0%{transform:translateY(0);opacity:1} 50%{opacity:.8} 100%{transform:translateY(-20px);opacity:0} }
      .droplet{display:inline-block;width:6px;height:6px;background:#fff;border-radius:50%;opacity:0;animation:rise 1s ease-in-out infinite}
    `}</style>
    <div className="flex justify-center items-center space-x-1 h-5">
      <span className="droplet" style={{ animationDelay: '0s' }} />
      <span className="droplet" style={{ animationDelay: '0.2s' }} />
      <span className="droplet" style={{ animationDelay: '0.4s' }} />
    </div>
  </>
);

const BubbleAnimation = () => {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.8,
        duration: 3 + Math.random() * 2,
        size: 40 + Math.random() * 60,
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {bubbles.map(b => (
        <motion.div
          key={b.id}
          className="absolute rounded-full"
          style={{
            left: `${b.left}%`,
            bottom: '-100px',
            width: `${b.size}px`,
            height: `${b.size}px`,
            background:
              'radial-gradient(circle at 30% 30%, rgba(255,255,255,.9), rgba(248,215,230,.7), rgba(232,180,212,.5))',
            boxShadow:
              'inset -10px -10px 30px rgba(255,255,255,.8), inset 5px 5px 20px rgba(248,215,230,.5), 0 0 30px rgba(248,215,230,.4)',
            border: '3px solid rgba(255,255,255,.5)',
            backdropFilter: 'blur(2px)',
          }}
          animate={{
            y: [0, -1200],
            x: [0, (Math.random() - 0.5) * 150],
            opacity: [0, 1, 1, 0.8, 0],
            scale: [0.5, 1.2, 1, 1, 0.8],
          }}
          transition={{ duration: b.duration, delay: b.delay, ease: [0.43, 0.13, 0.23, 0.96] }}
        />
      ))}
    </div>
  );
};

export default function UserProfile({ onNavigate, onLogout, currentPage = 'profile' }: UserProfileProps) {
  const name = useUserStore(state => state.name);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('activity');

  // 성분 입력/타입
  const [newIngredient, setNewIngredient] = useState('');
  const [newIngredientType, setNewIngredientType] = useState<'preferred' | 'caution'>('preferred');

  // 유저 데이터
  const [userData, setUserData] = useState({
    id: 0,
    name: '',
    nickname: '',
    email: '',
    birthDate: '',
    gender: 'na',
    skinType: '',
  });

  // 즐겨찾기/추천
  interface FavoriteProduct {
    product_id: number;
    product_name: string;
    brand: string;
    category: string;
    image_url: string;
    price_krw?: number;
    review_count?: number;
    capacity?: string;
    product_url?: string;
    rag_text?: string;
  }
  interface RecentRecommendation {
    product_pid: string;
    display_name: string;
    image_url: string;
    reason: string;
    category: string;
    price_krw?: number;
    review_count?: number;
    created_at?: string;
    type?: string;
    source?: string;
  }
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [recentRecommendations, setRecentRecommendations] = useState<RecentRecommendation[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const userId = Number(localStorage.getItem('user_id'));

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2000);
  };

  // 추천 히스토리
  useEffect(() => {
    const uid = localStorage.getItem('user_id');
    if (!uid) return;
    const key = `recent_recommendations_${uid}`;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      const flat = parsed
        .flatMap((s: any) =>
          (s.products || []).map((p: any) => ({ ...p, created_at: s.created_at, type: s.type }))
        )
        .sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      setRecentRecommendations(flat);
    } catch {}
  }, []);

  // 즐겨찾기 불러오기
  useEffect(() => {
    const fn = async () => {
      try {
        const res = await fetch(`${API_BASE}/favorite_products/${userId}`);
        if (res.ok) setFavorites(await res.json());
      } catch {}
    };
    if (userId) fn();
  }, [userId]);

  const removeFavorite = async (productId: number) => {
    if (!userId) return;
    try {
      const res = await fetch(
        `${API_BASE}/favorite_products/?user_id=${userId}&product_id=${productId}`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setFavorites(prev => prev.filter(f => f.product_id !== productId));
        showToast('즐겨찾기에서 제거되었습니다 💔');
      }
    } catch {}
  };

  const toggleFavorite = async (productId: number) => {
    if (!userId) return;
    const exists = favorites.some(f => f.product_id === productId);
    try {
      if (exists) {
        const res = await fetch(
          `${API_BASE}/favorite_products/?user_id=${userId}&product_id=${productId}`,
          { method: 'DELETE' }
        );
        if (res.ok) {
          setFavorites(prev => prev.filter(f => f.product_id !== productId));
          showToast('즐겨찾기에서 제거되었습니다 💔');
        }
      } else {
        const res = await fetch(
          `${API_BASE}/favorite_products/?user_id=${userId}&product_id=${productId}`,
          { method: 'POST' }
        );
        if (res.ok) {
          const src =
            recentRecommendations.find(p => Number(p.product_pid) === productId) || ({} as any);
          const newFav: FavoriteProduct = {
            product_id: productId,
            product_name: (src as any).display_name ?? '이름 없음',
            brand: (src as any).brand ?? '',
            category: (src as any).category ?? '',
            image_url: (src as any).image_url ?? '',
            price_krw: (src as any).price_krw ?? 0,
          };
          setFavorites(prev => [newFav, ...prev]);
          showToast('즐겨찾기에 추가되었습니다 ❤️');
        }
      }
    } catch {}
  };

  // 로그인/프로필 로드
  useEffect(() => {
    const idStr = localStorage.getItem('user_id');
    const currentUserId = Number.parseInt(idStr || '0', 10);
    if (!currentUserId) {
      onNavigate?.('login');
      return;
    }
    setUserData(prev => ({ ...prev, id: currentUserId }));
    (async () => {
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
      } catch {}
    })();
  }, [onNavigate]);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 2000));
    try {
      const updateData = {
        name: userData.name,
        email: userData.email,
        nickname: userData.nickname || userData.name,
        birthDate: userData.birthDate || null,
        gender: userData.gender || 'na',
        skinTypeCode: userData.skinType === '진단 필요' ? null : userData.skinType,
      };
      const updated = await updateUserProfile(userData.id, updateData as any);
      setUserData({
        id: updated.id,
        name: updated.name || '',
        nickname: updated.nickname || userData.name,
        email: updated.email || '',
        birthDate: updated.birthDate || '',
        gender: updated.gender || 'na',
        skinType: updated.skinType || '진단 필요',
      });
      setIsEditing(false);
    } catch {
    } finally {
      setIsSaving(false);
    }
  };

  // ───────────── 성분 DB 연동 ─────────────
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingLoading, setIngLoading] = useState(false);
  const [ingSearch, setIngSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setIngLoading(true);
      try {
        const res = await fetch(`${API_BASE}/ingredients/list_all?limit=5000`);
        if (res.ok) {
          const raw = await res.json();
          const cleaned: Ingredient[] = (raw || [])
            .map((r: any) => ({
              id: Number(r.id),
              korean_name: r.korean_name,
              english_name: r.english_name ?? null,
              description: r.description ?? null,
              caution_grade: r.caution_grade ?? r.caution ?? r.caution_g ?? null,
            }))
            .filter((x: Ingredient) => x.id && x.korean_name);
          setIngredients(cleaned);
        }
      } catch {
      } finally {
        setIngLoading(false);
      }
    };
    load();
  }, []);

  const filteredIngredients = useMemo(() => {
    const key = ingSearch.trim();
    if (!key) return ingredients;
    const lower = key.toLowerCase();
    return ingredients.filter(
      it =>
        it.korean_name.includes(key) ||
        (it.english_name ?? '').toLowerCase().includes(lower) ||
        (it.description ?? '').toLowerCase().includes(lower)
    );
  }, [ingSearch, ingredients]);

  // 선호/주의 목록 상태
  const [preferredIngredients, setPreferredIngredients] = useState<PreferredItem[]>([]);
  const [cautionIngredients, setCautionIngredients] = useState<CautionItem[]>([]);

  const addPreferred = (ing: Ingredient) => {
    if (preferredIngredients.some(i => i.id === ing.id)) return;
    setPreferredIngredients(prev => [
      { id: ing.id, name: ing.korean_name, benefit: ing.description || '' },
      ...prev,
    ]);
  };
  const addCaution = (ing: Ingredient) => {
    if (cautionIngredients.some(i => i.id === ing.id)) return;
    const sev: CautionItem['severity'] = (ing.caution_grade || '').includes('고')
      ? 'high'
      : (ing.caution_grade || '').includes('중')
        ? 'mid'
        : 'low';
    setCautionIngredients(prev => [
      { id: ing.id, name: ing.korean_name, reason: ing.description || '', severity: sev },
      ...prev,
    ]);
  };

  const handleAddIngredient = () => {
    const key = newIngredient.trim();
    if (!key) return;
    const hit =
      ingredients.find(i => i.korean_name === key) ||
      ingredients.find(i => i.korean_name.includes(key)) ||
      ingredients.find(i => (i.english_name || '').toLowerCase() === key.toLowerCase());
    if (!hit) return;
    if (newIngredientType === 'preferred') addPreferred(hit);
    else addCaution(hit);
    setNewIngredient('');
  };
  const removePreferredIngredient = (index: number) =>
    setPreferredIngredients(prev => prev.filter((_, i) => i !== index));
  const removeCautionIngredient = (index: number) =>
    setCautionIngredients(prev => prev.filter((_, i) => i !== index));

  const getSeverityColor = (severity: string) =>
    severity === 'high'
      ? 'bg-red-50 border-red-300'
      : severity === 'mid'
        ? 'bg-amber-50 border-amber-300'
        : 'bg-yellow-50 border-yellow-300';

  const getSeverityBadge = (severity: string) =>
    severity === 'high'
      ? 'bg-red-100 text-red-700'
      : severity === 'mid'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-yellow-100 text-yellow-700';

  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)' }}
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
                {name.charAt(0).toUpperCase()}
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
            />
          )}
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
                    value={userData.nickname || ''}
                    onChange={e => setUserData({ ...userData, nickname: e.target.value })}
                    placeholder={`별명을 입력하세요 (비워두면 "${userData.name}"으로 설정됩니다)`}
                    className="mt-4 text-xl font-bold text-gray-800 text-center px-3 py-1 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
                  />
                ) : (
                  <h3 className="mt-4 text-xl font-bold text-gray-800">
                    {userData.nickname || userData.name}
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
                        onChange={e => setUserData({ ...userData, birthDate: e.target.value })}
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

                  <div className="sm:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 mb-2 block">
                      피부 타입 (바우만)
                    </label>
                    <div className="flex flex-wrap gap-2 px-0 py-2 bg-gray-50 rounded-lg min-h-[44px] items-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={userData.skinType || ''}
                          readOnly
                          placeholder="예: OSNT"
                          maxLength={4}
                          className="w-24 px-3 py-1 text-purple-700 rounded-full text-md font-semibold focus:outline-none text-center cursor-default pointer-events-none select-none"
                        />
                      ) : (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-base font-semibold">
                          {userData.skinType || '진단 필요'}
                        </span>
                      )}
                      {isEditing && (
                        <button
                          onClick={() => onNavigate?.('diagnosis')}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-sm font-semibold hover:bg-pink-200 transition-colors"
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

        <div className="bg-white rounded-t-2xl shadow-lg mb-0">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('activity')}
              className={`flex-1 py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-semibold transition-colors ${
                activeTab === 'activity'
                  ? 'text-pink-600 border-b-2 border-pink-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              나의 활동
            </button>
            <button
              onClick={() => setActiveTab('ingredients')}
              className={`flex-1 py-3 sm:py-4 px-4 sm:px-6 text-sm sm:text-base font-semibold transition-colors ${
                activeTab === 'ingredients'
                  ? 'text-pink-600 border-b-2 border-pink-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
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
            <div className="flex flex-col space-y-6">
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Clock className="w-5 h-5 text-purple-500 mr-2" />
                  최근 찾아본 성분
                </h3>
                <div className="space-y-3">
                  <p className="text-gray-500 text-sm text-center py-6">
                    아직 조회한 성분이 없습니다.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Heart className="w-5 h-5 text-pink-500 mr-2" />
                  즐겨찾기 제품
                </h3>
                <AnimatePresence>
                  {toastMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 40 }}
                      transition={{ duration: 0.3 }}
                      className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-[999]"
                    >
                      {toastMsg}
                    </motion.div>
                  )}
                </AnimatePresence>

                {favorites.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">
                    아직 즐겨찾기한 제품이 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-3 sm:gap-4 min-w-max">
                      {favorites.map((product, index) => (
                        <motion.div
                          key={product.product_id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 * index }}
                          className="flex-shrink-0 w-40 sm:w-48 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 hover:shadow-md relative"
                          onClick={async () => {
                            try {
                              const res = await fetch(
                                `${API_BASE}/product/detail/${product.product_id}`
                              );
                              if (!res.ok) throw new Error('상세정보 불러오기 실패');
                              const data = await res.json();
                              setSelectedProduct({
                                step: data.category || '단계 정보 없음',
                                product_pid: data.product_pid,
                                image_url: data.image_url || '',
                                display_name:
                                  data.display_name ||
                                  `${data.brand || ''} - ${data.product_name || ''}`,
                                reason: data.category || '카테고리 정보 없음',
                                price_krw: data.price_krw ?? 0,
                                capacity: data.capacity || '용량 정보 없음',
                                product_url: data.product_url || '',
                                description: data.description || '제품 설명이 없습니다.',
                              });
                            } catch {}
                          }}
                        >
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              removeFavorite(product.product_id);
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-white rounded-full text-gray-500 hover:text-red-500 shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="w-full aspect-square bg-white rounded-lg mb-2 flex items-center justify-center">
                            <img
                              src={product.image_url}
                              alt={product.product_name}
                              className="w-full h-full object-contain rounded-lg"
                            />
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
                            {product.product_name}
                          </p>
                          <p className="text-[11px] text-gray-500">{product.category}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-pink-50 rounded-xl p-4 border border-pink-100">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 text-pink-500 mr-2" />
                  최근 추천받은 제품
                </h3>
                {recentRecommendations.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-6">
                    아직 추천받은 제품이 없습니다.
                  </p>
                ) : (
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-3 sm:gap-4 min-w-max">
                      {recentRecommendations.map((item, index) => (
                        <motion.div
                          key={`${item.product_pid}_${index}`}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                          className="flex-shrink-0 w-40 sm:w-48 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100 hover:shadow-md relative"
                          onClick={() => setSelectedProduct(item)}
                        >
                          <div className="w-full aspect-square bg-white rounded-lg mb-2 flex items-center justify-center">
                            <img
                              src={item.image_url}
                              alt={item.display_name}
                              className="w-full h-full object-contain rounded-lg"
                            />
                          </div>
                          <p className="text-xs sm:text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
                            {item.display_name}
                          </p>
                          <p className="text-[11px] text-gray-500">{item.category}</p>
                          <p className="text-[11px] font-semibold text-pink-600 mt-0.5">
                            {item.source === 'routine'
                              ? '맞춤 루틴 추천'
                              : item.source === 'chat'
                                ? 'AI 상담 추천'
                                : '기타 추천'}
                          </p>
                          {item.reason && (
                            <p className="text-[10px] text-gray-400 truncate">{item.reason}</p>
                          )}
                          {item.review_count !== undefined && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              리뷰 {item.review_count.toLocaleString()}개
                            </p>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 성분 DB 검색/목록(테이블 스타일 카드) */}
              <div className="rounded-xl p-4 sm:p-6 border border-pink-200 bg-gradient-to-r from-pink-50 to-purple-50">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 flex items-center">
                  <SearchIcon className="w-5 h-5 text-pink-500 mr-2" />
                  성분 DB
                </h3>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      value={ingSearch}
                      onChange={e => setIngSearch(e.target.value)}
                      placeholder="한글/영문/설명으로 검색"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
                    />
                    {ingLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <WaterDropletLoader />
                      </div>
                    )}
                  </div>
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

                {/* 목록 */}
                <div className="mt-4 border rounded-lg bg-white">
                  <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-gray-600 border-b">
                    <div className="col-span-3">한글명</div>
                    <div className="col-span-3">영문명</div>
                    <div className="col-span-4">설명</div>
                    <div className="col-span-1 text-center">주의</div>
                  </div>
                  <div className="max-h-[360px] overflow-auto divide-y">
                    {filteredIngredients.map(it => (
                      <div key={it.id} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                        <div className="col-span-3 font-semibold text-gray-800 line-clamp-1">
                          {it.korean_name}
                        </div>
                        <div className="col-span-3 text-gray-600 text-xs line-clamp-1">
                          {it.english_name || '-'}
                        </div>
                        <div className="col-span-4 text-gray-600 text-xs line-clamp-2">
                          {it.description || '-'}
                        </div>
                        <div className="col-span-1 flex flex-col items-center gap-2">
                          <span
                            className={
                              (it.caution_grade || '').includes('고')
                                ? 'px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700'
                                : (it.caution_grade || '').includes('중')
                                  ? 'px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700'
                                  : 'px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600'
                            }
                          >
                            {it.caution_grade || '-'}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => addPreferred(it)}
                              className="px-2 py-0.5 rounded text-[11px] bg-green-100 text-green-700"
                            >
                              선호
                            </button>
                            <button
                              onClick={() => addCaution(it)}
                              className="px-2 py-0.5 rounded text-[11px] bg-red-100 text-red-700"
                            >
                              주의
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredIngredients.length === 0 ? (
                      <div className="px-3 py-6 text-center text-sm text-gray-500">
                        검색 결과가 없습니다.
                      </div>
                    ) : (
                      <>
                        <div className="px-3 py-6 text-center text-sm text-gray-500">
                          {filteredIngredients.length} 성분 검색 결과
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 선호/주의 보관함 (기존 UI 유지) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-green-50 rounded-xl p-4 sm:p-6 border border-green-200">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4 flex items-center">
                    <Sparkles className="w-5 h-5 text-green-500 mr-2" />
                    선호 성분 ({preferredIngredients.length})
                  </h3>
                  <div className="space-y-3">
                    {preferredIngredients.map((ingredient, index) => (
                      <motion.div
                        key={ingredient.id}
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
                    {preferredIngredients.length === 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">
                        추가된 선호 성분이 없습니다.
                      </div>
                    )}
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
                        key={ingredient.id}
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
                    {cautionIngredients.length === 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">
                        추가된 주의 성분이 없습니다.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onToggleFavorite={pid => toggleFavorite(Number(pid))}
        favorites={favorites.map(f => f.product_id)}
        mode="profile"
      />

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
