import { API_BASE } from '@/lib/env';
import { UserProfile, UpdateUserProfileDTO } from '../model/types';

export const userApi = {
  /**
   * 사용자 프로필 조회
   */
  async fetchProfile(userId: number): Promise<UserProfile> {
    const response = await fetch(`${API_BASE}/api/profile/${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }
    const data = await response.json();
    return {
      id: data.id,
      name: data.name || '',
      nickname: data.nickname || '',
      email: data.email || '',
      birthDate: data.birthDate || null,
      gender: data.gender || 'na',
      skinType: data.skinType || data.skin_type_code || '진단 필요',
    };
  },

  /**
   * 사용자 프로필 업데이트
   */
  async updateProfile(userId: number, data: UpdateUserProfileDTO): Promise<UserProfile> {
    const response = await fetch(`${API_BASE}/api/profile/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error('Failed to update user profile');
    }
    const updated = await response.json();
    return {
      id: updated.id,
      name: updated.name || '',
      nickname: updated.nickname || '',
      email: updated.email || '',
      birthDate: updated.birthDate || null,
      gender: updated.gender || 'na',
      skinType: updated.skinType || updated.skin_type_code || '진단 필요',
    };
  },
};
