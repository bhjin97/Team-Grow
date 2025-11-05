import { API_BASE } from '@/lib/env';
import { RoutineProduct } from '../model/types';

export const routineApi = {
  /**
   * 맞춤 루틴 조회
   */
  async fetchRoutine(
    baumannType: string,
    season: string,
    timeOfDay: string,
    keywords: string[]
  ): Promise<RoutineProduct[]> {
    const params = new URLSearchParams({
      baumann_type: baumannType,
      season,
      time_of_day: timeOfDay,
      focus_keywords: keywords.join(','),
    });

    const response = await fetch(`${API_BASE}/custom_routine?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch routine');
    }
    return response.json();
  },
};
