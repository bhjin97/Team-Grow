import React, { useState } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../lib/env";

type BeautyAILoginProps = {
  onLogin?: (email: string, password: string) => void;
  onNavigateSignup?: () => void;
  onNavigateForgotPassword?: () => void; // ✅ 비밀번호 찾기용 prop 추가
};

export default function BeautyAILogin({
  onLogin,
  onNavigateSignup,
  onNavigateForgotPassword,
}: BeautyAILoginProps) {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        alert("로그인 실패: " + (err.detail || "알 수 없는 오류"));
        setLoading(false);
        return;
      }

      const data = await res.json();
      console.log("로그인 성공:", data);

      onLogin?.(formData.email, formData.password);
    } catch (err) {
      console.error(err);
      alert("서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left Side - Brand Section */}
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
                fontFamily: "'Poiret One', 'Quicksand', 'Nunito', sans-serif",
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

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="mb-6 sm:mb-8">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 sm:mb-3">
              로그인
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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
                className="w-full px-4 py-3 sm:py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-all text-base"
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
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 sm:py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-all text-base"
                required
              />
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 sm:py-4 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all text-base sm:text-lg disabled:opacity-60 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)",
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {loading ? "로그인 중..." : "로그인"}
            </motion.button>
          </form>

          {/* 하단 안내 영역 */}
          <div className="mt-6 sm:mt-8 text-center space-y-3">
            <p className="text-gray-600 text-sm sm:text-base">
              계정이 없으신가요?{" "}
              <button
                onClick={() => onNavigateSignup?.()}
                className="text-pink-400 font-semibold hover:text-pink-500 transition-colors"
              >
                회원가입
              </button>
            </p>

            {/* ✅ 비밀번호 찾기 버튼 추가 */}
            <button
              onClick={() => onNavigateForgotPassword?.()}
              className="text-gray-500 text-sm hover:text-pink-400 transition-colors underline"
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
