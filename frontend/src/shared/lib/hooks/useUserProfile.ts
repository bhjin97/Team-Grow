import { useState, useEffect } from 'react';
import { userApi, UserProfile } from '@/entities/user';

export const useUserProfile = (userId: number | null) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await userApi.fetchProfile(userId);
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);
    try {
      const updated = await userApi.updateProfile(userId, {
        name: updates.name,
        email: updates.email,
        nickname: updates.nickname,
        birthDate: updates.birthDate,
        gender: updates.gender,
        skinTypeCode: updates.skinType === '진단 필요' ? null : updates.skinType,
      });
      setProfile(updated);
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    setProfile,
  };
};
