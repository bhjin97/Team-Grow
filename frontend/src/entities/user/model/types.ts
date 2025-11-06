export interface UserProfile {
  id: number;
  name: string;
  nickname: string;
  email: string;
  birthDate: string | null;
  gender: 'female' | 'male' | 'other' | 'na';
  skinType: string; // Baumann skin type code (e.g., "ORNT")
}

export interface UpdateUserProfileDTO {
  name?: string;
  email?: string;
  nickname?: string;
  birthDate?: string | null;
  gender?: 'female' | 'male' | 'other' | 'na';
  skinTypeCode?: string | null;
}
