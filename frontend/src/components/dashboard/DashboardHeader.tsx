'use client';

import * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Menu,
  X,
  LayoutDashboard,
  MessageSquare,
  UserCircle,
  Settings as SettingsIcon,
  Bell,
  Sparkles,
} from 'lucide-react';
import { useUserStore } from '@/stores/auth/store';

interface DashboardHeaderProps {
  userName?: string;
  onNavigate?: (page: string) => void;
  currentPage?: string;
  aiSavedCount?: number;
}

export default function DashboardHeader({
  userName = 'Sarah',
  onNavigate,
  currentPage = 'dashboard',
}: DashboardHeaderProps) {
  const name = useUserStore(state => state.name);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="bg-white/80 backdrop-blur-lg border-b border-pink-100 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <h1
            className="text-5xl sm:text-6xl font-light tracking-wide"
            style={{ fontFamily: "'Italianno', cursive", color: '#9b87f5' }}
          >
            aller
          </h1>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => onNavigate?.('dashboard')}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium"
              style={
                currentPage === 'dashboard'
                  ? {
                      background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                      color: 'white',
                    }
                  : {}
              }
            >
              <LayoutDashboard className="w-5 h-5" /> <span>대시보드</span>
            </button>
            <button
              onClick={() => onNavigate?.('features')}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium"
              style={
                currentPage === 'features'
                  ? {
                      background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                      color: 'white',
                    }
                  : { color: '#6b7280' }
              }
            >
              <Sparkles className="w-5 h-5" /> <span>기능</span>
            </button>
            <button
              onClick={() => onNavigate?.('chat')}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg font-medium"
              style={
                currentPage === 'chat'
                  ? {
                      background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                      color: 'white',
                    }
                  : { color: '#6b7280' }
              }
            >
              <MessageSquare className="w-5 h-5" /> <span>AI 상담</span>
            </button>
            <button
              onClick={() => onNavigate?.('profile')}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
            >
              <UserCircle className="w-5 h-5" /> <span>프로필</span>
            </button>
            <button
              onClick={() => onNavigate?.('settings')}
              className="flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
            >
              <SettingsIcon className="w-5 h-5" /> <span>설정</span>
            </button>
          </nav>

          {/* Notifications & Profile */}
          <div className="hidden md:flex items-center space-x-4">
            <button className="p-2 text-gray-600 hover:text-pink-600 relative">
              <Bell className="w-6 h-6" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button
              onClick={() => onNavigate?.('profile')}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
              style={{ background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)' }}
            >
              {name.charAt(0).toUpperCase()}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-700"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden mt-4 space-y-3"
          >
            <button
              onClick={() => {
                onNavigate?.('dashboard');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold"
              style={
                currentPage === 'dashboard'
                  ? {
                      background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                      color: 'white',
                    }
                  : { color: '#6b7280' }
              }
            >
              <LayoutDashboard className="w-5 h-5" /> <span>대시보드</span>
            </button>
            <button
              onClick={() => {
                onNavigate?.('features');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold"
              style={
                currentPage === 'features'
                  ? {
                      background: 'linear-gradient(135deg, #f5c6d9 0%, #e8b4d4 100%)',
                      color: 'white',
                    }
                  : { color: '#6b7280' }
              }
            >
              <Sparkles className="w-5 h-5" /> <span>기능</span>
            </button>
            <button
              onClick={() => {
                onNavigate?.('chat');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
            >
              <MessageSquare className="w-5 h-5" /> <span>AI 상담</span>
            </button>
            <button
              onClick={() => {
                onNavigate?.('profile');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
            >
              <UserCircle className="w-5 h-5" /> <span>프로필</span>
            </button>
            <button
              onClick={() => {
                onNavigate?.('settings');
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center space-x-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-pink-50"
            >
              <SettingsIcon className="w-5 h-5" /> <span>설정</span>
            </button>
          </motion.div>
        )}
      </div>
    </header>
  );
}
