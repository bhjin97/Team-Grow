// components/ForgotPassword.tsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../lib/env";

type ForgotPasswordProps = {
  onNavigateLogin: () => void;
  onNavigateSettings?: () => void;              // ✅ 설정으로 돌아가기용 (로그인 상태)
  startStep?: "find" | "reset";                 // ✅ 기본: find, 설정에서는 reset
  prefillEmail?: string;                        // ✅ 설정에서 이메일 자동 채우기
};

export default function ForgotPassword({
  onNavigateLogin,
  onNavigateSettings,
  startStep = "find",
  prefillEmail,
}: ForgotPasswordProps) {
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [maskedPassword, setMaskedPassword] = useState<string | null>(null);
  const [step, setStep] = useState<"find" | "reset">(startStep);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [justFound, setJustFound] = useState(false); // 버튼 아래 힌트 표시용

  useEffect(() => {
    if (prefillEmail) {
      setFormData((p) => ({ ...p, email: prefillEmail }));
    }
  }, [prefillEmail]);

  const handleChange = (field: string, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  // 비번 일부 확인 (버튼 아래 출력)
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
      setMaskedPassword(data.maskedPassword);
      setJustFound(true); // 버튼 아래 표시 트리거
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      alert("비밀번호는 6자리 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("비밀번호가 일치하지 않습니다.");
      return;
    }
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

    // ✅ 어디서 왔는지에 따라 복귀 경로 분기
    if (onNavigateSettings) onNavigateSettings();
    else onNavigateLogin();
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* 왼쪽: 로그인과 동일한 비주얼 */}
      <div
        className="w-full lg:w-1/2 relative overflow-hidden flex items-center justify-center p-6 sm:p-8 lg:p-12 min-h-[30vh] lg:min-h-screen"
        style={{ background: "linear-gradient(135deg, #f8d7e6 0%, #dac4e8 50%, #c4d4f0 100%)" }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <motion.div className="absolute w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96 rounded-full"
            style={{
              background:"radial-gradient(circle, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.1) 50%, transparent 70%)",
              backdropFilter:"blur(60px)", border:"2px solid rgba(255,255,255,0.3)",
              boxShadow:"0 8px 32px 0 rgba(255,255,255,0.2), inset 0 0 60px rgba(255,255,255,0.1)",
              top:"5%", left:"10%",
            }}
            animate={{ y: [0, 30, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div className="absolute w-48 h-48 sm:w-56 sm:h-56 lg:w-64 lg:h-64 rounded-full"
            style={{
              background:"radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.1) 50%, transparent 70%)",
              backdropFilter:"blur(40px)", border:"2px solid rgba(255,255,255,0.2)",
              bottom:"20%", left:"25%",
            }}
            animate={{ y: [0, -20, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <motion.div className="absolute w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full"
            style={{
              background:"radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 50%, transparent 70%)",
              backdropFilter:"blur(30px)", border:"1px solid rgba(255,255,255,0.3)",
              boxShadow:"0 4px 16px 0 rgba(255,255,255,0.2)", bottom:"10%", left:"15%",
            }}
            animate={{ y: [0, 15, 0], x: [0, 10, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          />
        </div>
        <div className="relative z-10 text-center">
          <motion.h1
            className="text-4xl sm:text-5xl lg:text-6xl"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}
            style={{
              fontFamily: "'Italianno', cursive", fontStyle: "italic", fontWeight: "300",
              letterSpacing: "0.05em", background:"linear-gradient(135deg, #9b87f5 0%, #7e69e0 50%, #c084fc 100%)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text",
            }}
          >
            alerre
          </motion.h1>
        </div>
      </div>

      {/* 오른쪽: 단계별 폼 */}
      <div className="w-full lg:w-1/2 bg-white flex items-center justify-center p-6 sm:p-8 lg:p-12">
        <motion.div className="w-full max-w-md" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
          {step === "find" && (
            <>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 text-center">비밀번호 찾기</h2>
              <form onSubmit={handleFindPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">이름</label>
                  <input
                    type="text" value={formData.name} onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">이메일</label>
                  <input
                    type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)}
                    placeholder="가입 시 사용한 이메일을 입력하세요"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
                    required
                  />
                </div>
                <motion.button
                  type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)" }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                  {loading ? "조회 중..." : "비밀번호 확인"}
                </motion.button>

                {/* ✅ 버튼 아래 힌트 출력 */}
                {justFound && maskedPassword && (
                  <div className="text-center mt-4">
                    <p className="text-gray-700">
                      비밀번호 : <span className="font-mono font-bold text-pink-500">{maskedPassword}</span>
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-3 mt-4">
                      <button onClick={onNavigateLogin} className="text-gray-600 text-sm hover:text-pink-400 underline">
                        로그인으로 가기
                      </button>
                      <button onClick={() => setStep("reset")} className="text-gray-600 text-sm hover:text-pink-400 underline">
                        비밀번호 변경하기
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </>
          )}

          {step === "reset" && (
            <>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 text-center">새 비밀번호 설정</h2>
              <div className="space-y-5">
                <input
                  type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호 입력"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="새 비밀번호 확인"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
                />
                <motion.button
                  onClick={handleResetPassword} disabled={loading}
                  className="w-full py-3.5 rounded-xl font-medium text-white shadow-lg hover:shadow-xl transition-all text-base disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)" }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                  {loading ? "변경 중..." : "비밀번호 변경"}
                </motion.button>

                <div className="text-center mt-4">
                  <button
                    onClick={onNavigateSettings ? onNavigateSettings : onNavigateLogin}
                    className="text-gray-600 text-sm hover:text-pink-400 underline"
                  >
                    {onNavigateSettings ? "설정으로 돌아가기" : "로그인으로 돌아가기"}
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
