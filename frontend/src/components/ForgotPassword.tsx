import React, { useState } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../lib/env";

type ForgotPasswordProps = {
  onNavigateLogin: () => void;
};

export default function ForgotPassword({ onNavigateLogin }: ForgotPasswordProps) {
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [maskedPassword, setMaskedPassword] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ 입력값 변경 핸들러
  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ✅ 비밀번호 일부만 표시 요청
  const handleFindPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/find_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        alert("비밀번호를 찾을 수 없습니다. " + (err.detail || ""));
        setLoading(false);
        return;
      }

      const data = await res.json();
      setMaskedPassword(data.maskedPassword); // 서버에서 예: "ab****yz"
      setShowReset(true);
    } catch (err) {
      console.error(err);
      alert("서버와 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ 새 비밀번호 설정
  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      alert("새 비밀번호는 6자리 이상이어야 합니다.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/reset_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, newPassword }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert("비밀번호 변경 실패: " + (err.detail || ""));
        return;
      }

      alert("비밀번호가 성공적으로 변경되었습니다!");
      onNavigateLogin();
    } catch (err) {
      console.error(err);
      alert("서버 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* 왼쪽 디자인 영역 */}
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
        </div>

        <div className="relative z-10 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
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
          </motion.h1>
        </div>
      </div>

      {/* 오른쪽: 비밀번호 찾기 폼 */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 text-center">
            비밀번호 찾기
          </h2>

          {!maskedPassword ? (
            <form onSubmit={handleFindPassword} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  이름
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  이메일
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="가입 시 사용한 이메일을 입력하세요"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-all"
                  required
                />
              </div>

              <motion.button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)",
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading ? "조회 중..." : "비밀번호 확인"}
              </motion.button>
            </form>
          ) : (
            <div className="space-y-5 text-center">
              <p className="text-gray-700 text-base">
                비밀번호 :{" "}
                <span className="font-mono font-bold text-pink-500">
                  {maskedPassword}
                </span>
              </p>

              {showReset && (
                <div>
                  <p className="text-gray-600 text-sm mb-3">
                    기억이 나지 않나요? 새 비밀번호를 설정하세요.
                  </p>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="새 비밀번호 입력"
                    className="w-full px-4 py-3 mb-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition-all"
                  />
                  <motion.button
                    onClick={handleResetPassword}
                    className="w-full py-3.5 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all text-base"
                    style={{
                      background:
                        "linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)",
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    새 비밀번호 설정
                  </motion.button>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={onNavigateLogin}
              className="text-gray-500 text-sm hover:text-pink-400 transition-colors underline"
            >
              로그인으로 돌아가기
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
