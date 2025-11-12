// frontend/src/stores/auth/store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { StoreState, UserState } from './type';

export const userState = {
  name: '',
  email: '',
};

export const useUserStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // 기존 유저 상태
      ...userState,

      // 성분 관련 상태 추가
      preferredIngredients: [],
      cautionIngredients: [],

      // 기존 액션
      login: (data: UserState) => {
        set({ name: data.name, email: data.email });
      },

      logout: () =>
        set({
          name: '',
          email: '',
          // 로그아웃 시 성분 정보도 초기화
          preferredIngredients: [],
          cautionIngredients: [],
        }),

      // 성분 관련 액션 추가
      setPreferredIngredients: ingredients =>
        set({
          preferredIngredients: ingredients,
        }),

      setCautionIngredients: ingredients =>
        set({
          cautionIngredients: ingredients,
        }),

      addIngredient: ingredient => {
        const state = get();
        if (ingredient.type === 'preferred') {
          set({
            preferredIngredients: [...state.preferredIngredients, ingredient],
          });
        } else {
          set({
            cautionIngredients: [...state.cautionIngredients, ingredient],
          });
        }
      },

      removeIngredient: (ingredientId, type) => {
        const state = get();
        if (type === 'preferred') {
          set({
            preferredIngredients: state.preferredIngredients.filter(
              item => item.id !== ingredientId
            ),
          });
        } else {
          set({
            cautionIngredients: state.cautionIngredients.filter(item => item.id !== ingredientId),
          });
        }
      },

      clearIngredients: () =>
        set({
          preferredIngredients: [],
          cautionIngredients: [],
        }),
    }),
    {
      name: 'aller-user-storage', // 로컬스토리지 키
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        // 필요한 상태만 저장
        name: state.name,
        email: state.email,
        preferredIngredients: state.preferredIngredients,
        cautionIngredients: state.cautionIngredients,
      }),
    }
  )
);
