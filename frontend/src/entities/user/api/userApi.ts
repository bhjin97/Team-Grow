import { API_BASE } from '@/lib/env';
import { UserProfile, UpdateUserProfileDTO } from '../model/types';

/** YYYY-MM-DD 로 정규화 */
function toISODate(value?: string | null): string | null {
  if (!value) return null;
  const v = String(value).trim();

  // 이미 ISO면 그대로
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // 2025/1/2, 2025.1.2 같은 형태 정규화
  const cleaned = v.replace(/[./]/g, '-');
  const m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) {
    // date input 값이 아닌 경우(예: 숫자년만) 방어적으로 null
    return null;
  }
  const [, y, mo, d] = m;
  const mm = mo.padStart(2, '0');
  const dd = d.padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

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

    // 백엔드 응답의 다양한 키를 흡수하고 ISO로 정규화
    const birth =
      data.birthDate ??
      data.birth_date ??
      data.birthdate ?? // 혹시 옛 키가 존재할 수도 있음
      null;

    const birthISO = toISODate(birth);

    return {
      id: data.id || userId,
      name: data.name || '',
      nickname: data.nickname || '',
      email: data.email || emailFromStorage,
      birthDate: birthISO, // 프론트 표준은 항상 YYYY-MM-DD
      gender: data.gender || 'na',
      skinType: data.skinType || data.skin_type_code || '진단 필요',
    };
  },

  /**
   * 사용자 프로필 업데이트
   * - birthDate는 YYYY-MM-DD로 정규화하여 'birthDate' 키로 전송
   *   (백엔드 Pydantic: UserProfileUpdate.birthDate)
   */
  async updateProfile(userId: number, data: UpdateUserProfileDTO): Promise<UserProfile> {
    // 안전한 페이로드 구성: 정의된 값만 포함
    const payload: Record<string, any> = {};

    if (typeof data.name !== 'undefined') payload.name = data.name;
    if (typeof data.email !== 'undefined') payload.email = data.email;
    if (typeof data.nickname !== 'undefined') payload.nickname = data.nickname;
    if (typeof data.gender !== 'undefined') payload.gender = data.gender;
    if (typeof (data as any).skinType !== 'undefined') payload.skinType = (data as any).skinType;
    if (typeof data.skinTypeCode !== 'undefined') payload.skinTypeCode = data.skinTypeCode;

    // 날짜 정규화 → 백엔드 스키마 키는 birthDate (문자열)
    const iso = toISODate(data.birthDate ?? null);
    if (iso) payload.birthDate = iso;

    const response = await fetch(`${API_BASE}/api/user_card/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to update user profile');
    }

    const updated = await response.json();

    const updatedBirth =
      updated.birthDate ??
      updated.birth_date ??
      updated.birthdate ??
      iso ?? // 서버가 그대로 echo 안 해주면, 방금 보낸 값 사용
      null;

    return {
      id: updated.id || userId,
      name: updated.name ?? (data.name || ''),
      nickname: updated.nickname ?? (data.nickname || ''),
      email: updated.email ?? (data.email || ''),
      birthDate: toISODate(updatedBirth),
      gender: updated.gender ?? (data.gender || 'na'),
      skinType: updated.skinType || updated.skin_type_code || (data as any).skinType || '진단 필요',
    };
  },
};
