import React, { useState } from 'react';
import { motion } from 'framer-motion';
type BeautyAILoginProps = {
  onLogin?: (email: string, password: string) => void;
  onNavigateSignup?: () => void;
};

// @component: BeautyAILogin
export const BeautyAILogin = (props: BeautyAILoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (props.onLogin) {
      props.onLogin(email, password);
    }
  };

  // @return
  return <div className="min-h-screen w-full flex flex-col lg:flex-row">
      {/* Left Side - Beautiful Bubble Background */}
      <div className="w-full lg:w-1/2 relative overflow-hidden flex items-center justify-center p-8 lg:p-12 min-h-[40vh] lg:min-h-screen" style={{
      background: 'linear-gradient(135deg, #f8d7e6 0%, #dac4e8 50%, #c4d4f0 100%)'
    }}>
        {/* Animated Bubbles */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Large bubble */}
          <motion.div className="absolute rounded-full" style={{
          width: '350px',
          height: '350px',
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.3) 40%, rgba(255,255,255,0.1) 70%, transparent 100%)',
          border: '2px solid rgba(255,255,255,0.4)',
          boxShadow: 'inset 0 0 80px rgba(255,255,255,0.3), 0 8px 40px rgba(255,255,255,0.2)',
          top: '10%',
          left: '15%'
        }} animate={{
          y: [0, 30, 0],
          x: [0, 10, 0],
          scale: [1, 1.03, 1]
        }} transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}>
            {/* Inner highlight for bubble effect */}
            <div className="absolute rounded-full" style={{
            width: '80px',
            height: '80px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.3) 100%)',
            top: '15%',
            left: '20%',
            filter: 'blur(8px)'
          }} />
          </motion.div>

          {/* Medium bubble */}
          <motion.div className="absolute rounded-full" style={{
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.25) 40%, rgba(255,255,255,0.08) 70%, transparent 100%)',
          border: '2px solid rgba(255,255,255,0.35)',
          boxShadow: 'inset 0 0 60px rgba(255,255,255,0.25), 0 8px 30px rgba(255,255,255,0.15)',
          bottom: '25%',
          left: '25%'
        }} animate={{
          y: [0, -25, 0],
          x: [0, 15, 0],
          scale: [1, 1.05, 1]
        }} transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1
        }}>
            <div className="absolute rounded-full" style={{
            width: '50px',
            height: '50px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.2) 100%)',
            top: '18%',
            left: '22%',
            filter: 'blur(6px)'
          }} />
          </motion.div>

          {/* Small bubble with extra shine */}
          <motion.div className="absolute rounded-full" style={{
          width: '120px',
          height: '120px',
          background: 'radial-gradient(circle at 35% 25%, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.35) 30%, rgba(255,255,255,0.1) 60%, transparent 100%)',
          border: '2px solid rgba(255,255,255,0.45)',
          boxShadow: 'inset 0 0 50px rgba(255,255,255,0.35), 0 6px 25px rgba(255,255,255,0.2)',
          bottom: '15%',
          left: '12%'
        }} animate={{
          y: [0, 20, 0],
          x: [0, -8, 0],
          scale: [1, 1.08, 1]
        }} transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2
        }}>
            <div className="absolute rounded-full" style={{
            width: '35px',
            height: '35px',
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.4) 100%)',
            top: '20%',
            left: '25%',
            filter: 'blur(4px)'
          }} />
            {/* Small shine spot */}
            <div className="absolute rounded-full" style={{
            width: '12px',
            height: '12px',
            background: 'rgba(255,255,255,0.9)',
            bottom: '30%',
            right: '30%',
            filter: 'blur(2px)'
          }} />
          </motion.div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 bg-[#faf9f7] flex items-center justify-center p-8 lg:p-12">
        <motion.div className="w-full max-w-md" initial={{
        opacity: 0,
        x: 20
      }} animate={{
        opacity: 1,
        x: 0
      }} transition={{
        duration: 0.6,
        delay: 0.2
      }}>
          {/* Header */}
          <div className="mb-10">
            <h2 className="text-5xl font-bold text-gray-900 mb-3">로그인</h2>
            <p className="text-gray-400 text-base">당신의 뷰티 여정으로 다시 돌아오세요</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* E-mail Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                이메일
              </label>
              <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일을 입력하세요" className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-transparent transition-all text-base shadow-sm" required />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                비밀번호
              </label>
              <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-transparent transition-all text-base shadow-sm" required />
            </div>

            {/* Login Button - Matching the image's pink color */}
            <motion.button type="submit" className="w-full py-4 rounded-2xl font-medium text-white shadow-md hover:shadow-lg transition-all text-base mt-8" style={{
            background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)'
          }} whileHover={{
            scale: 1.01
          }} whileTap={{
            scale: 0.99
          }}>
              로그인
            </motion.button>
          </form>

          {/* Links */}
          <div className="mt-8 text-center space-y-3">
            <a href="#" className="block text-indigo-400 hover:text-indigo-500 transition-colors text-sm">
              아이디 또는 비밀번호를 잊으셨나요?
            </a>
            <p className="text-gray-600 text-sm">
              계정이 없으신가요?{' '}
              <button onClick={() => props.onNavigateSignup?.()} className="text-indigo-400 font-semibold hover:text-indigo-500 transition-colors">
                회원가입
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>;
};