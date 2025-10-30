'use client';

import * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  Menu,
  X,
  Home,
  MessageSquare,
  UserCircle,
  Settings as SettingsIcon,
  Bell,
  BellOff,
  LogOut,
  Moon,
  Sun,
  Globe,
  Lock,
  Smartphone,
  Mail,
  Shield,
  Info,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
} from 'lucide-react';
export interface SettingsProps {
  userName?: string;
  onNavigate?: (page: string) => void;
  onLogout?: () => void;
}
export default function Settings({ userName = 'Sarah', onNavigate, onLogout }: SettingsProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // 알림 설정
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [productUpdates, setProductUpdates] = useState(true);
  const [weeklyReport, setWeeklyReport] = useState(false);

  // 앱 설정
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('ko');
  const handleLogout = () => {
    if (window.confirm('정말 로그아웃 하시겠습니까?')) {
      onLogout?.();
    }
  };
  return (
    <div
      className="min-h-screen w-full pb-16 md:pb-0"
      style={{
        background: 'linear-gradient(135deg, #fce7f3 0%, #f3e8ff 50%, #ddd6fe 100%)',
      }}
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-pink-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo */}
            <div className="flex items-center space-x-2">
              <h1
                className="text-5xl sm:text-6xl font-light tracking-wide"
                style={{
                  fontFamily: "'Italianno', cursive",
                  color: '#9b87f5',
                }}
              >
                aller
              </h1>
            </div>

            {/* Center: Navigation (Hidden on mobile) */}
            <nav className="hidden md:flex items-center space-x-1">
              <button
                onClick={() => onNavigate?.('dashboard')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>대시보드</span>
              </button>
              <button
                onClick={() => onNavigate?.('chat')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <MessageSquare className="w-5 h-5" />
                <span>AI 상담</span>
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50 font-medium transition-colors"
              >
                <UserCircle className="w-5 h-5" />
                <span>프로필</span>
              </button>
              <button
                onClick={() => onNavigate?.('settings')}
                className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                  color: 'white',
                }}
              >
                <SettingsIcon className="w-5 h-5" />
                <span>설정</span>
              </button>
            </nav>

            {/* Right: Notifications & Profile (Hidden on mobile) */}
            <div className="hidden md:flex items-center space-x-4">
              <button className="p-2 text-gray-600 hover:text-pink-600 transition-colors relative">
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                }}
              >
                {userName.charAt(0).toUpperCase()}
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-700 hover:text-pink-600 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {mobileMenuOpen && (
            <motion.div
              initial={{
                opacity: 0,
                y: -10,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="md:hidden mt-4 pb-4 space-y-3"
            >
              <button
                onClick={() => {
                  onNavigate?.('dashboard');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>대시보드</span>
              </button>
              <button
                onClick={() => {
                  onNavigate?.('chat');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
              >
                <MessageSquare className="w-5 h-5" />
                <span>AI 상담</span>
              </button>
              <button
                onClick={() => {
                  onNavigate?.('profile');
                  setMobileMenuOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
              >
                <UserCircle className="w-5 h-5" />
                <span>프로필</span>
              </button>
              <button
                onClick={() => {
                  onNavigate?.('settings');
                  setMobileMenuOpen(false);
                }}
                style={{
                  background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 rounded-lg text-white font-semibold"
              >
                <SettingsIcon className="w-5 h-5" />
                <span>설정</span>
              </button>
            </motion.div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-4xl">
        <motion.div
          initial={{
            opacity: 0,
            y: 20,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.5,
          }}
        >
          <div className="flex items-center mb-6 sm:mb-8">
            <SettingsIcon className="w-8 h-8 text-pink-600 mr-3" />
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">설정</h2>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* 알림 설정 */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center mb-4 sm:mb-6">
                <Bell className="w-6 h-6 text-purple-600 mr-3" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">알림 설정</h3>
              </div>

              <div className="space-y-4">
                {/* Push 알림 */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-gray-800">푸시 알림</p>
                      <p className="text-xs sm:text-sm text-gray-500">모바일 푸시 알림 수신</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPushNotifications(!pushNotifications)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${pushNotifications ? 'bg-pink-500' : 'bg-gray-300'}`}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                      animate={{
                        x: pushNotifications ? 24 : 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  </button>
                </div>

                {/* 이메일 알림 */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-gray-800">
                        이메일 알림
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        중요한 업데이트를 이메일로 받기
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEmailNotifications(!emailNotifications)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${emailNotifications ? 'bg-pink-500' : 'bg-gray-300'}`}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                      animate={{
                        x: emailNotifications ? 24 : 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  </button>
                </div>

                {/* 제품 업데이트 */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <Info className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-gray-800">
                        제품 업데이트
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">새로운 제품 추천 알림</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setProductUpdates(!productUpdates)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${productUpdates ? 'bg-pink-500' : 'bg-gray-300'}`}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                      animate={{
                        x: productUpdates ? 24 : 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  </button>
                </div>

                {/* 주간 리포트 */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-gray-800">
                        주간 리포트
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">매주 피부 상태 요약 받기</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setWeeklyReport(!weeklyReport)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${weeklyReport ? 'bg-pink-500' : 'bg-gray-300'}`}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                      animate={{
                        x: weeklyReport ? 24 : 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* 앱 설정 */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center mb-4 sm:mb-6">
                <SettingsIcon className="w-6 h-6 text-blue-600 mr-3" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">앱 설정</h3>
              </div>

              <div className="space-y-4">
                {/* 다크 모드 */}
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    {darkMode ? (
                      <Moon className="w-5 h-5 text-gray-500" />
                    ) : (
                      <Sun className="w-5 h-5 text-gray-500" />
                    )}
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-gray-800">다크 모드</p>
                      <p className="text-xs sm:text-sm text-gray-500">어두운 테마 사용</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-indigo-500' : 'bg-gray-300'}`}
                  >
                    <motion.div
                      className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                      animate={{
                        x: darkMode ? 24 : 0,
                      }}
                      transition={{
                        type: 'spring',
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  </button>
                </div>

                {/* 언어 설정 */}
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center space-x-3">
                    <Globe className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="text-sm sm:text-base font-semibold text-gray-800">언어</p>
                      <p className="text-xs sm:text-sm text-gray-500">앱 표시 언어</p>
                    </div>
                  </div>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
                  >
                    <option value="ko">한국어</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 보안 및 개인정보 */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center mb-4 sm:mb-6">
                <Shield className="w-6 h-6 text-green-600 mr-3" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">보안 및 개인정보</h3>
              </div>

              <div className="space-y-3">
                <button className="w-full flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Lock className="w-5 h-5 text-gray-500" />
                    <span className="text-sm sm:text-base font-medium text-gray-800">
                      비밀번호 변경
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button className="w-full flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-gray-500" />
                    <span className="text-sm sm:text-base font-medium text-gray-800">
                      개인정보 처리방침
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>

                <button className="w-full flex items-center justify-between py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <Info className="w-5 h-5 text-gray-500" />
                    <span className="text-sm sm:text-base font-medium text-gray-800">
                      서비스 이용약관
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>

            {/* 계정 관리 */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="flex items-center mb-4 sm:mb-6">
                <User className="w-6 h-6 text-orange-600 mr-3" />
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">계정 관리</h3>
              </div>

              <div className="space-y-3">
                <motion.button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-3 py-3 px-4 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
                  whileHover={{
                    scale: 1.02,
                  }}
                  whileTap={{
                    scale: 0.98,
                  }}
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm sm:text-base">로그아웃</span>
                </motion.button>

                <button className="w-full py-2 text-sm text-gray-500 hover:text-red-600 transition-colors">
                  계정 삭제
                </button>
              </div>
            </div>

            {/* 앱 정보 */}
            <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-500">앱 버전</p>
                <p className="text-lg font-bold text-gray-800">aller v1.0.0</p>
                <p className="text-xs text-gray-400">© 2024 aller. All rights reserved.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-pink-100 z-50">
        <div className="flex items-center justify-around px-4 py-3">
          <button
            onClick={() => onNavigate?.('dashboard')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-xs">대시보드</span>
          </button>
          <button
            onClick={() => onNavigate?.('chat')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-xs">AI 상담</span>
          </button>
          <button
            onClick={() => onNavigate?.('profile')}
            className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
          >
            <UserCircle className="w-6 h-6" />
            <span className="text-xs">프로필</span>
          </button>
          <button
            onClick={() => onNavigate?.('settings')}
            className="flex flex-col items-center space-y-1 text-pink-600"
          >
            <SettingsIcon className="w-6 h-6" />
            <span className="text-xs font-semibold">설정</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
