import { User, Mail, Calendar, Heart, Camera } from 'lucide-react';
import { Card, Input } from '@/shared/ui';
import { UserProfile } from '@/entities/user';

export interface UserInfoCardProps {
  profile: UserProfile;
  isEditing: boolean;
  onUpdate: (updates: Partial<UserProfile>) => void;
  onNavigate?: (page: string) => void;
}

export const UserInfoCard = ({ profile, isEditing, onUpdate, onNavigate }: UserInfoCardProps) => {
  return (
    <Card padding="lg">
      <div className="flex flex-col md:flex-row gap-6">
        {/* 프로필 이미지 */}
        <div className="flex flex-col items-center md:items-start">
          <div className="relative">
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
            >
              <User className="w-16 h-16 text-white" />
            </div>
            {isEditing && (
              <button className="absolute bottom-0 right-0 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-pink-600 hover:bg-pink-50 transition-colors">
                <Camera className="w-5 h-5" />
              </button>
            )}
          </div>
          {isEditing ? (
            <input
              type="text"
              value={profile.nickname || ''}
              onChange={e => onUpdate({ nickname: e.target.value })}
              placeholder={`별명을 입력하세요 (비워두면 "${profile.name}"으로 설정됩니다)`}
              className="mt-4 text-xl font-bold text-gray-800 text-center px-3 py-1 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-full"
            />
          ) : (
            <h3 className="mt-4 text-xl font-bold text-gray-800">
              {profile.nickname || profile.name}
            </h3>
          )}
        </div>

        {/* 프로필 정보 */}
        <div className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 이름 */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                이름 (수정 불가)
              </label>
              <p className="text-sm text-gray-600 px-4 py-2 bg-gray-100 rounded-lg border border-gray-300">
                {profile.name || '(미입력)'}
              </p>
            </div>

            {/* 이메일 */}
            <div>
              {isEditing ? (
                <Input
                  label="이메일"
                  type="email"
                  value={profile.email || ''}
                  onChange={e => onUpdate({ email: e.target.value })}
                  placeholder="example@email.com"
                  leftIcon={<Mail className="w-4 h-4" />}
                />
              ) : (
                <>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center">
                    <Mail className="w-4 h-4 mr-2" /> 이메일
                  </label>
                  <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg break-all">
                    {profile.email || '(미입력)'}
                  </p>
                </>
              )}
            </div>

            {/* 생년월일 */}
            <div>
              {isEditing ? (
                <Input
                  label="생년월일"
                  type="date"
                  value={profile.birthDate || ''}
                  onChange={e => onUpdate({ birthDate: e.target.value })}
                  leftIcon={<Calendar className="w-4 h-4" />}
                />
              ) : (
                <>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center">
                    <Calendar className="w-4 h-4 mr-2" /> 생년월일
                  </label>
                  <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg">
                    {profile.birthDate || '(미입력)'}
                  </p>
                </>
              )}
            </div>

            {/* 성별 */}
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-2 block flex items-center">
                <Heart className="w-4 h-4 mr-2" /> 성별
              </label>
              {isEditing ? (
                <select
                  value={profile.gender || 'na'}
                  onChange={e =>
                    onUpdate({ gender: e.target.value as UserProfile['gender'] })
                  }
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white"
                >
                  <option value="na">선택 안함</option>
                  <option value="female">여성</option>
                  <option value="male">남성</option>
                  <option value="other">기타</option>
                </select>
              ) : (
                <p className="text-sm text-gray-600 px-4 py-2 bg-gray-50 rounded-lg">
                  {profile.gender === 'female'
                    ? '여성'
                    : profile.gender === 'male'
                      ? '남성'
                      : profile.gender === 'other'
                        ? '기타'
                        : '(미입력)'}
                </p>
              )}
            </div>

            {/* 피부 타입 */}
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-gray-700 mb-2 block">
                피부 타입 (바우만)
              </label>
              <div className="flex flex-wrap gap-2 px-0 py-2 bg-gray-50 rounded-lg min-h-[44px] items-center">
                {isEditing ? (
                  <input
                    type="text"
                    value={profile.skinType || ''}
                    readOnly
                    placeholder="예: OSNT"
                    maxLength={4}
                    className="w-24 px-3 py-1 text-purple-700 rounded-full text-md font-semibold focus:outline-none text-center cursor-default pointer-events-none select-none"
                  />
                ) : (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-base font-semibold">
                    {profile.skinType || '진단 필요'}
                  </span>
                )}
                {isEditing && (
                  <button
                    onClick={() => onNavigate?.('diagnosis')}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-pink-100 text-pink-700 text-sm font-semibold hover:bg-pink-200 transition-colors"
                  >
                    다시 진단
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
