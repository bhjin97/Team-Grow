// frontend/src/pages/profile/ui/ProfilePage.tsx
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '@/stores/auth/store';
import { useUserProfile, useToast, useFavorites, useRecentRecommendations } from '@/shared';
import { SimpleToast, LoadingOverlay } from '@/shared/ui';
import {
  Ingredient,
  IngredientType,
  PreferredIngredient,
  CautionIngredient,
} from '@/entities/ingredient';
import { productApi } from '@/entities/product';
import { UserInfoCard } from '@/widgets/user-info-card';
import { ActivityTab } from '@/widgets/activity-tab';
import { IngredientsTab } from '@/widgets/ingredients-tab';
import { IngredientSearchSection } from '@/features/add-ingredient';
import { EditProfileButtons } from '@/features/edit-profile';
import { ProfileHeader } from './ProfileHeader';
import { ProfileTabs, TabType } from './ProfileTabs';
import { ProfileBottomNav } from './ProfileBottomNav';
import ProductDetailModal from '@/components/dashboard/ProductDetailModal';

export interface ProfilePageProps {
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}

// 버블 애니메이션
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

export const ProfilePage = ({ onNavigate, onLogout }: ProfilePageProps) => {
  const {
    name,
    preferredIngredients,
    cautionIngredients,
    setPreferredIngredients,
    setCautionIngredients,
    removeIngredient,
  } = useUserStore();

  const [userId, setUserId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  // Hooks
  const { profile, isLoading: profileLoading, updateProfile, setProfile } = useUserProfile(userId);
  const { toast, showToast } = useToast();
  const {
    favorites,
    isLoading: favoritesLoading,
    toggleFavorite,
    isFavorite,
  } = useFavorites(userId);
  const { recommendations } = useRecentRecommendations();

  // 로딩 상태만 로컬에서 관리 (Store에 저장할 필요 없음)
  const [loadingStates, setLoadingStates] = useState<{
    add: boolean;
    delete: { [key: number]: boolean };
  }>({
    add: false,
    delete: {},
  });

  // 사용자 ID 로드
  useEffect(() => {
    const idStr = localStorage.getItem('user_id');
    const currentUserId = Number.parseInt(idStr || '0', 10);
    if (!currentUserId) {
      onNavigate?.('login');
      return;
    }
    setUserId(currentUserId);
  }, [onNavigate]);

  // 사용자 성분 목록 로드
  useEffect(() => {
    if (!userId) return;

    // 이미 Store에 데이터가 있으면 API 호출 스킵
    if (preferredIngredients.length > 0 || cautionIngredients.length > 0) {
      return;
    }

    const loadUserIngredients = async () => {
      try {
        const response = await fetch(`/api/user-ingredients?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();

          const preferred = data
            .filter((item: any) => item.type === 'preferred')
            .map((item: any) => ({
              id: item.ingredientId,
              name: item.ingredientName,
              benefit: item.description || '',
              type: 'preferred' as const,
            }));

          const caution = data
            .filter((item: any) => item.type === 'caution')
            .map((item: any) => ({
              id: item.ingredientId,
              name: item.ingredientName,
              reason: item.description || '',
              severity: item.severity || 'low',
              type: 'caution' as const,
            }));

          // Store에 저장
          setPreferredIngredients(preferred);
          setCautionIngredients(caution);
        }
      } catch (error) {
        console.error('Failed to load user ingredients:', error);
      }
    };

    loadUserIngredients();
  }, [
    userId,
    preferredIngredients.length,
    cautionIngredients.length,
    setPreferredIngredients,
    setCautionIngredients,
  ]);

  // 프로필 저장
  const handleSave = async () => {
    if (!profile) return;

    setIsSaving(true);
    try {
      await updateProfile(profile);
      setIsEditing(false);
      showToast('프로필이 성공적으로 업데이트되었습니다', 'success');
    } catch (error) {
      showToast('프로필 업데이트에 실패했습니다', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 성분 추가 (DB 연동)
  const handleAddIngredient = async (ingredient: Ingredient, type: IngredientType) => {
    // 유효성 검사
    if (!ingredient.korean_name?.trim()) {
      showToast('성분명이 올바르지 않습니다', 'warning');
      return;
    }

    // 중복 체크
    const isDuplicate =
      type === 'preferred'
        ? preferredIngredients.some(i => i.id === ingredient.id)
        : cautionIngredients.some(i => i.id === ingredient.id);

    if (isDuplicate) {
      showToast('이미 추가된 성분입니다', 'warning');
      return;
    }

    setLoadingStates(prev => ({ ...prev, add: true }));

    try {
      // DB에 저장
      const response = await fetch('/api/user-ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName: name || profile?.name || '', // ← 이 한 줄 추가!
          koreanName: ingredient.korean_name,
          ingType: type,
          ingredientId: ingredient.id,
          ingredientName: ingredient.korean_name,
          type: type,
          description: ingredient.description || '',
          severity:
            type === 'caution'
              ? ingredient.caution_grade?.includes('고')
                ? 'high'
                : ingredient.caution_grade?.includes('중')
                  ? 'mid'
                  : 'low'
              : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add ingredient');
      }

      // 성공시 Store 업데이트
      const newIngredient = {
        id: ingredient.id,
        name: ingredient.korean_name,
        type: type as 'preferred' | 'caution',
        ...(type === 'preferred'
          ? { benefit: ingredient.description || '' }
          : {
              reason: ingredient.description || '',
              severity: (ingredient.caution_grade?.includes('고')
                ? 'high'
                : ingredient.caution_grade?.includes('중')
                  ? 'mid'
                  : 'low') as 'low' | 'mid' | 'high',
            }),
      };
      // Store의 addIngredient 액션 사용
      useUserStore.getState().addIngredient(newIngredient);

      showToast(
        `${ingredient.korean_name}을(를) ${type === 'preferred' ? '선호' : '주의'} 성분에 추가했습니다`,
        'success'
      );
    } catch (error) {
      console.error('성분 추가 실패:', error);
      showToast('성분 추가에 실패했습니다', 'error');
    } finally {
      setLoadingStates(prev => ({ ...prev, add: false }));
    }
  };

  // 성분 삭제 (Store 연동)
  const handleDeleteIngredient = async (ingredientId: number, type: 'preferred' | 'caution') => {
    // 삭제 확인
    const ingredient =
      type === 'preferred'
        ? preferredIngredients.find(i => i.id === ingredientId)
        : cautionIngredients.find(i => i.id === ingredientId);

    if (!ingredient) return;

    if (!window.confirm(`${ingredient.name}을(를) 삭제하시겠습니까?`)) {
      return;
    }

    // 로딩 상태 설정
    setLoadingStates(prev => ({
      ...prev,
      delete: { ...prev.delete, [ingredientId]: true },
    }));

    // 낙관적 업데이트 - Store에서 먼저 제거
    removeIngredient(ingredientId, type);

    try {
      const response = await fetch(`/api/user-ingredients/${userId}/${ingredientId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete ingredient');
      }

      showToast('성분이 삭제되었습니다', 'success');
    } catch (error) {
      // 실패시 롤백 - 다시 추가
      if (ingredient) {
        useUserStore.getState().addIngredient({
          ...ingredient,
          type: type,
        });
      }
      console.error('성분 삭제 실패:', error);
      showToast('삭제 실패. 다시 시도해주세요', 'error');
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        delete: { ...prev.delete, [ingredientId]: false },
      }));
    }
  };

  // 즐겨찾기 제거
  const handleRemoveFavorite = async (productId: number) => {
    try {
      await toggleFavorite(productId);
      showToast('즐겨찾기에서 제거되었습니다 💔', 'success');
    } catch {
      showToast('제거에 실패했습니다', 'error');
    }
  };

  // 제품 클릭
  const handleProductClick = async (productId: number) => {
    try {
      const detail = await productApi.fetchDetail(productId);
      setSelectedProduct(detail);
    } catch {
      showToast('제품 정보를 불러오는데 실패했습니다', 'error');
    }
  };

  // 초기 로딩 중
  if (profileLoading && !profile) {
    return <LoadingOverlay message="프로필 로딩 중..." />;
  }

  // 프로필이 없으면 빈 화면 (로그인으로 리다이렉트됨)
  if (!profile) {
    return null;
  }

  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)' }}
    >
      {isSaving && <BubbleAnimation />}

      <ProfileHeader userName={name} onNavigate={onNavigate} />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        {/* 프로필 정보 섹션 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">개인 정보</h2>
            <EditProfileButtons
              isEditing={isEditing}
              isSaving={isSaving}
              onEdit={() => setIsEditing(true)}
              onSave={handleSave}
              onCancel={() => {
                setIsEditing(false);
              }}
            />
          </div>

          <UserInfoCard
            profile={profile}
            isEditing={isEditing}
            onUpdate={updates => setProfile(prev => (prev ? { ...prev, ...updates } : prev))}
            onNavigate={onNavigate}
          />
        </motion.div>

        {/* 탭 시스템 */}
        <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* 탭 콘텐츠 */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-b-2xl shadow-lg p-4 sm:p-6"
        >
          {activeTab === 'activity' ? (
            <ActivityTab
              favorites={favorites}
              recommendations={recommendations}
              onRemoveFavorite={handleRemoveFavorite}
              onFavoriteClick={handleProductClick}
              onRecommendationClick={product => setSelectedProduct(product)}
            />
          ) : (
            <IngredientsTab
              preferredIngredients={preferredIngredients}
              cautionIngredients={cautionIngredients}
              onRemovePreferred={index => {
                const ingredient = preferredIngredients[index];
                handleDeleteIngredient(ingredient.id, 'preferred');
              }}
              onRemoveCaution={index => {
                const ingredient = cautionIngredients[index];
                handleDeleteIngredient(ingredient.id, 'caution');
              }}
              searchSection={<IngredientSearchSection onAddIngredient={handleAddIngredient} />}
            />
          )}
        </motion.div>
      </main>

      <ProfileBottomNav onNavigate={onNavigate} />

      {/* 제품 상세 모달 */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onToggleFavorite={pid => toggleFavorite(Number(pid))}
        favorites={favorites.map(f => f.product_id)}
        mode="profile"
      />

      {/* Toast */}
      <SimpleToast message={toast.message || ''} isVisible={toast.isVisible} />
    </div>
  );
};
