'use client';

import * as React from 'react';
import { LayoutDashboard, MessageSquare, UserCircle, Sparkles } from 'lucide-react';

interface DashboardBottomNavProps {
  onNavigate?: (page: string) => void;
  currentPage?: string;
  chatBadgeCount?: number;  // 👈 추가
}

export default function DashboardBottomNav({onNavigate, currentPage = 'dashboard', chatBadgeCount = 0, }: DashboardBottomNavProps) {

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-pink-100 z-50">
      <div className="flex items-center justify-around px-2 py-3">
        <button 
          onClick={() => onNavigate?.('dashboard')} 
          className={`flex flex-col items-center ${currentPage === 'dashboard' ? 'text-pink-600' : 'text-gray-500 hover:text-pink-600'}`}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-xs font-semibold">대시보드</span>
        </button>
        <button 
          onClick={() => onNavigate?.('features')} 
          className={`flex flex-col items-center ${currentPage === 'features' ? 'text-pink-600' : 'text-gray-500 hover:text-pink-600'}`}
        >
          <Sparkles className="w-6 h-6" />
          <span className="text-xs">기능</span>
        </button>
        <button 
          onClick={() => onNavigate?.('chat')} 
          className={`flex flex-col items-center ${currentPage === 'chat' ? 'text-pink-600' : 'text-gray-500 hover:text-pink-600'}`}
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-xs">AI 상담</span>
        </button>
        <button 
          onClick={() => onNavigate?.('profile')} 
          className={`flex flex-col items-center ${currentPage === 'profile' ? 'text-pink-600' : 'text-gray-500 hover:text-pink-600'}`}
        >
          <UserCircle className="w-6 h-6" />
          <span className="text-xs">프로필</span>
        </button>
      </div>
    </nav>
  );
}