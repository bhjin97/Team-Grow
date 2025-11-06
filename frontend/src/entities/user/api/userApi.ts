import { API_BASE } from '@/lib/env';
import { UserProfile, UpdateUserProfileDTO } from '../model/types';

export const userApi = {
  /**
   * 사용자 프로필 조회
   */
  async fetchProfile(userId: number): Promise<UserProfile> {
    const response = await fetch(`${API_BASE}/api/user_card/${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user profile');
    }
    const data = await response.json();
    
    // 로컬스토리지에서 이메일 가져오기 (백엔드에서 안 오는 경우 대비)
    const emailFromStorage = localStorage.getItem('user_email') || '';
    
    return {
      id: data.id || userId,
      name: data.name || '',
      nickname: data.nickname || '',
      email: data.email || emailFromStorage,
      birthDate: data.birthDate || data.birth_date || null,
      gender: data.gender || 'na',
      skinType: data.skinType || data.skin_type_code || '진단 필요',
    };
  },

  /**
   * 사용자 프로필 업데이트
   */
  async updateProfile(userId: number, data: UpdateUserProfileDTO): Promise<UserProfile> {
    const response = await fetch(`${API_BASE}/api/user_card/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        nickname: data.nickname,
        birthYear: data.birthDate ? new Date(data.birthDate).getFullYear() : null,
        gender: data.gender,
        skinTypeCode: data.skinTypeCode,
      }),
    });
    if (!response.ok) {
      throw new Error('Failed to update user profile');
    }
    const updated = await response.json();
    return {
      id: updated.id || userId,
      name: updated.name || '',
      nickname: updated.nickname || '',
      email: updated.email || data.email || '',
      birthDate: updated.birthDate || updated.birth_date || null,
      gender: updated.gender || 'na',
      skinType: updated.skinType || updated.skin_type_code || '진단 필요',
    };
  },
};
