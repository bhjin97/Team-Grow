import { create } from 'zustand';
import { UserState, UserAction } from './type';

export const userState = {
  name: '',
  email: '',
};

export const useUserStore = create<UserState & UserAction>(set => ({
  ...userState,
  login: (data: UserState) => {
    set({ name: data.name, email: data.email });
  },
  logout: () => set({ name: '', email: '' }),
}));
