export interface RoutineProduct {
  step: string;
  product_pid: string;
  image_url: string;
  display_name: string;
  reason: string;
  category?: string;
  price_krw?: number;
  review_count?: number;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type TimeOfDay = 'morning' | 'evening';

export interface RoutineFilters {
  baumannType: string;
  season: Season;
  timeOfDay: TimeOfDay;
  keywords: string[];
}

// 키워드 룰
export const FOCUS_RULES: Record<string, string[]> = {
  summer_morning: ['가벼운', '산뜻'],
  summer_evening: ['보습', '진정'],
  winter_morning: ['보습', '보호막'],
  winter_evening: ['영양', '재생'],
  spring_morning: ['진정', '보습'],
  spring_evening: ['재생', '영양'],
  autumn_morning: ['보습', '보호'],
  autumn_evening: ['영양', '재생'],
};

export const ALL_KEYWORD_OPTIONS = Array.from(new Set(Object.values(FOCUS_RULES).flat()));
