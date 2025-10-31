import { useState, useMemo } from 'react';
import { Container, Theme } from './settings/types';
import BeautyAILogin from './components/BeautyAILogin';
import SignupForm from './components/SignupForm';
import Dashboard from './components/dashboard/Dashboard';
import ChatInterface from './components/ChatInterface';
import UserProfile from './components/UserProfile';
import Settings from './components/Settings';
import SkinDiagnosis from './components/dashboard/SkinDiagnosis';
import Survey from './components/dashboard/Survey'; // ← 여기! 설문으로

let theme: Theme = 'light';
let container: Container = 'none';

type PageType =
  | 'login'
  | 'signup'
  | 'dashboard'
  | 'chat'
  | 'profile'
  | 'settings'
  | 'diagnosis'
  | 'survey'; // ← 설문 페이지 이름은 이걸로 고정

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('Sarah');

  function setTheme(theme: Theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  setTheme(theme);

  const handleLogin = (email: string, password: string) => {
    console.log('Logging in with:', email);
    setIsLoggedIn(true);
    setCurrentPage('dashboard');
    const name = email.split('@')[0];
    setUserName(name.charAt(0).toUpperCase() + name.slice(1));
  };

  const handleSignup = (userData: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    birthday: string;
  }) => {
    console.log('Signing up with:', userData);
    setIsLoggedIn(true);
    setCurrentPage('dashboard');
    const firstName = userData.fullName.split(' ')[0];
    setUserName(firstName);
  };

  const handleNavigate = (page: string) => {
    if (
      page === 'dashboard' ||
      page === 'chat' ||
      page === 'profile' ||
      page === 'settings' ||
      page === 'diagnosis' ||
      page === 'survey' // ← 정확히 소문자 survey
    ) {
      setCurrentPage(page as PageType);
    }
  };

  const handleNavigateSignup = () => {
    setCurrentPage('signup');
  };

  const handleNavigateLogin = () => {
    setCurrentPage('login');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('login');
    setUserName('Sarah');
  };

  const generatedComponent = useMemo(() => {
    // 로그인 전
    if (!isLoggedIn) {
      if (currentPage === 'signup') {
        return <SignupForm onSignup={handleSignup} onNavigateLogin={handleNavigateLogin} />;
      }
      return <BeautyAILogin onLogin={handleLogin} onNavigateSignup={handleNavigateSignup} />;
    }

    // 로그인 후
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard userName={userName} onNavigate={handleNavigate} />;
      case 'diagnosis':
        // 1단계: 설명 화면
        return (
          <SkinDiagnosis
            onBack={() => setCurrentPage('dashboard')}
            onStart={() => setCurrentPage('survey')} // ← 여기! 설문으로
          />
        );
      case 'survey':
        // 2단계: 설문 화면
        return <Survey onDone={() => setCurrentPage('dashboard')} />;
      case 'chat':
        return <ChatInterface userName={userName} onNavigate={handleNavigate} />;
      case 'profile':
        return <UserProfile onNavigate={handleNavigate} onLogout={handleLogout} />;
      case 'settings':
        return <Settings userName={userName} onNavigate={handleNavigate} onLogout={handleLogout} />;
      default:
        return <Dashboard userName={userName} onNavigate={handleNavigate} />;
    }
  }, [currentPage, isLoggedIn, userName]);

  if (container === 'centered') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        {generatedComponent}
      </div>
    );
  } else {
    return generatedComponent;
  }
}

export default App;
