import React, { useState } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../lib/env";

// [★] 회원가입용 대형 비눗방울 애니메이션 컴포넌트
const SignupBubbleAnimation = () => {
  const bubbles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 4 + Math.random() * 2,
    size: 80 + Math.random() * 140, // [★] 80-360px (랜덤하게 다양한 크기!)
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          className="absolute rounded-full"
          style={{
            left: `${bubble.left}%`,
            bottom: '-500px', // [★] 맨 밑에서 시작
            width: `${bubble.size}px`,
            height: `${bubble.size}px`,
            background: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95), rgba(218, 196, 232, 0.8), rgba(192, 212, 240, 0.6))',
            boxShadow: 'inset -20px -20px 60px rgba(255, 255, 255, 0.9), inset 12px 12px 40px rgba(218, 196, 232, 0.6), 0 0 60px rgba(218, 196, 232, 0.5)',
            border: '5px solid rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
          animate={{
            y: [0, -1800], // [★] 더 높이 올라감
            x: [0, (Math.random() - 0.5) * 200],
            opacity: [0, 1, 1, 1, 0.9, 0],
            scale: [0.5, 1.4, 1.2, 1.1, 1, 0.8],
          }}
          transition={{
            duration: bubble.duration,
            delay: bubble.delay,
            ease: [0.43, 0.13, 0.23, 0.96],
          }}
        />
      ))}
    </div>
  );
};

// [★] 회원가입 성공 모달 컴포넌트
const SuccessModal = ({ onClose }: { onClose: () => void }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 배경 오버레이 */}
      <motion.div
        className="absolute inset-0 bg-black bg-opacity-50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
      />
      
      {/* 모달 */}
      <motion.div
        className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
      >
        {/* 성공 아이콘 */}
        <div className="flex justify-center mb-6">
          <motion.div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
            }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>
        </div>

        {/* 메시지 */}
        <h2 className="text-3xl font-bold text-center mb-3 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
          축하합니다! 🎉
        </h2>
        <p className="text-gray-600 text-center mb-8">
          회원가입이 완료되었습니다.<br />
          로그인 페이지로 이동합니다.
        </p>

        {/* 확인 버튼 */}
        <motion.button
          onClick={onClose}
          className="w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg hover:shadow-xl transition-all"
          style={{
            background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          확인
        </motion.button>
      </motion.div>
    </div>
  );
};

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

export default function SignupForm({
  onSignup,
  onNavigateLogin,
}: SignupFormProps) {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false); // [★] 성공 모달 표시 상태

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password.length < 6) {
      setErrors((prev) => ({
        ...prev,
        password: "비밀번호는 6자 이상이어야 합니다",
      }));
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "비밀번호가 일치하지 않습니다",
      }));
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
        setLoading(false); // [★] 실패 시 loading false
        return;
      }

      const data = await res.json();
      console.log("회원가입 성공:", data);

      // [★] loading 종료하고 성공 모달 표시
      setLoading(false);
      setShowSuccessModal(true);
      
    } catch (err) {
      console.error(err);
      alert("서버와 연결할 수 없습니다.");
      setLoading(false);
    }
  };

  // [★] 모달 확인 후 비눗방울 애니메이션 시작
  const handleModalClose = async () => {
    setShowSuccessModal(false);
    
    // 비눗방울 애니메이션 시작
    setLoading(true);
    
    // 5초 대기 (비눗방울 애니메이션 시간)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    setLoading(false);
    onNavigateLogin?.();
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* [★] 회원가입 중 비눗방울 애니메이션 */}
      {loading && <SignupBubbleAnimation />}
      
      {/* [★] 회원가입 성공 모달 */}
      {showSuccessModal && <SuccessModal onClose={handleModalClose} />}
      
      {/* ✅ 왼쪽 면 디자인 (로그인과 동일) */}
      <div
        className="w-full lg:w-1/2 relative overflow-hidden flex items-center justify-center p-6 sm:p-8 lg:p-12 min-h-[30vh] lg:min-h-screen"
        style={{
          background:
            "linear-gradient(135deg, #f8d7e6 0%, #dac4e8 50%, #c4d4f0 100%)",
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 50%, transparent 70%)",
              backdropFilter: "blur(60px)",
              border: "2px solid rgba(255,255,255,0.3)",
              boxShadow:
                "0 8px 32px 0 rgba(255,255,255,0.2), inset 0 0 60px rgba(255,255,255,0.1)",
              top: "5%",
              left: "10%",
            }}
            animate={{ y: [0, 30, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 50%, transparent 70%)",
              backdropFilter: "blur(40px)",
              border: "2px solid rgba(255,255,255,0.2)",
              boxShadow:
                "0 8px 32px 0 rgba(255,255,255,0.15), inset 0 0 40px rgba(255,255,255,0.1)",
              bottom: "20%",
              left: "25%",
            }}
            animate={{ y: [0, -20, 0], scale: [1, 1.08, 1] }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
          />
          <motion.div
            className="absolute w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 50%, transparent 70%)",
              backdropFilter: "blur(30px)",
              border: "1px solid rgba(255,255,255,0.3)",
              boxShadow: "0 4px 16px 0 rgba(255,255,255,0.2)",
              bottom: "10%",
              left: "15%",
            }}
            animate={{ y: [0, 15, 0], x: [0, 10, 0], scale: [1, 1.1, 1] }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
          />
        </div>
        <div className="relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl"
              style={{
                fontFamily:
                  "'Poiret One', 'Quicksand', 'Nunito', sans-serif",
                fontStyle: "italic",
                fontWeight: "300",
                letterSpacing: "0.05em",
                background:
                  "linear-gradient(135deg, #9b87f5 0%, #7e69e0 50%, #c084fc 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              alerre
            </h1>
          </motion.div>
        </div>
      </div>

      {/* ✅ 오른쪽 면은 기존 회원가입 폼 그대로 유지 */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="mb-6 sm:mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              회원가입
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-semibold text-gray-900 mb-2"
              >
                이름
              </label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="이름을 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900"
                required
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-gray-900 mb-2"
              >
                이메일
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="이메일을 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900"
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-gray-900 mb-2"
              >
                비밀번호
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder="비밀번호 (6자 이상)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900"
                required
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold text-gray-900 mb-2"
              >
                비밀번호 확인
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  handleChange("confirmPassword", e.target.value)
                }
                placeholder="비밀번호를 다시 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900"
                required
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.confirmPassword}
                </p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-60"
              style={{
                background:
                  "linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? "가입 중..." : "회원가입"}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              이미 계정이 있으신가요?{" "}
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