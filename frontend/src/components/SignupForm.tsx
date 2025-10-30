import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { API_BASE } from "../lib/env";

export interface SignupFormProps {
  onSignup?: (userData: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    birthday: string;
  }) => void;
  onNavigateLogin?: () => void;
}

export default function SignupForm({ onSignup, onNavigateLogin }: SignupFormProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password.length < 6) {
      setErrors(prev => ({ ...prev, password: '비밀번호는 6자 이상이어야 합니다' }));
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: '비밀번호가 일치하지 않습니다' }));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert("회원가입 실패: " + (err.detail || "알 수 없는 오류"));
        return;
      }

      const data = await res.json();
      console.log("회원가입 성공:", data);

      // 부모(App.tsx)로 전달
      onSignup?.({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        phone: '',
        birthday: ''
      });

      alert("회원가입 완료! 로그인 페이지로 이동해주세요.");
      onNavigateLogin?.();

    } catch (err) {
      console.error(err);
      alert("서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left Side - 기존 디자인 (버블 + 브랜드 로고) */}
      <div
        className="w-full lg:w-1/2 relative overflow-hidden flex items-center justify-center p-6 sm:p-8 lg:p-12 min-h-[30vh] lg:min-h-screen"
        style={{ background: 'linear-gradient(135deg, #f8d7e6 0%, #dac4e8 50%, #c4d4f0 100%)' }}
      >
        {/* 기존 버블 애니메이션 그대로 유지 */}
        <div className="relative z-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl"
              style={{
                fontFamily: "'Poiret One', 'Quicksand', 'Nunito', sans-serif",
                fontStyle: 'italic',
                fontWeight: '300',
                letterSpacing: '0.05em',
                background: 'linear-gradient(135deg, #9b87f5 0%, #7e69e0 50%, #c084fc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              alerre
            </h1>
          </motion.div>
        </div>
      </div>

      {/* Right Side - 회원가입 폼 */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="mb-6 sm:mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">회원가입</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-sm font-semibold text-gray-900 mb-2">이름</label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                placeholder="이름을 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">이메일</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="이메일을 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">비밀번호</label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="비밀번호 (6자 이상)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900"
                required
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-900 mb-2">비밀번호 확인</label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                placeholder="비밀번호를 다시 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900"
                required
              />
              {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? "가입 중..." : "회원가입"}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              이미 계정이 있으신가요?{' '}
              <button
                onClick={() => onNavigateLogin?.()}
                className="text-pink-400 font-semibold hover:text-pink-500"
              >
                로그인
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
