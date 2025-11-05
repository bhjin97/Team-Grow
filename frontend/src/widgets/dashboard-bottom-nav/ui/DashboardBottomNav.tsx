import {
  LayoutDashboard,
  MessageSquare,
  UserCircle,
  Settings as SettingsIcon,
} from 'lucide-react';

export interface DashboardBottomNavProps {
  onNavigate?: (page: string) => void;
}

export const DashboardBottomNav = ({ onNavigate }: DashboardBottomNavProps) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-pink-100 z-50">
      <div className="flex items-center justify-around py-3">
        <button
          onClick={() => onNavigate?.('dashboard')}
          className="flex flex-col items-center space-y-1 text-pink-600"
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-xs font-semibold">대시보드</span>
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
          className="flex flex-col items-center space-y-1 text-gray-500 hover:text-pink-600 transition-colors"
        >
          <SettingsIcon className="w-6 h-6" />
          <span className="text-xs">설정</span>
        </button>
      </div>
    </nav>
  );
};
