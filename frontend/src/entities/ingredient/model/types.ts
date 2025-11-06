export interface Ingredient {
  id: number;
  korean_name: string;
  english_name?: string | null;
  description?: string | null;
  caution_grade?: string | null; // '주의', '고위험' 등
}

export interface PreferredIngredient {
  id: number;
  name: string;
  benefit: string;
}

export interface CautionIngredient {
  id: number;
  name: string;
  reason: string;
  severity: 'low' | 'mid' | 'high';
}

export type IngredientType = 'preferred' | 'caution';
