import { useState, useMemo } from 'react';
import { Container, Theme } from './settings/types';
import BeautyAILogin from './components/BeautyAILogin';
import SignupForm from './components/SignupForm';
import Dashboard from './components/dashboard/Dashboard';
import UserProfile from './components/UserProfile';
import Settings from './components/Settings';
import SkinDiagnosis from './components/dashboard/SkinDiagnosis';
import Survey from './components/dashboard/Survey';
import ForgotPassword from './components/ForgotPassword';
import { useUserStore } from './stores/auth';
<<<<<<< HEAD
import Chatbot from './components/Chatbot';
=======
import { ProfilePage } from './pages/profile';
>>>>>>> e3d823b (Feat/ingredients search (#103))

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
  | 'survey'
  | 'forgotPassword';

function App() {
  // TODO: LocalStrorage 에도 저장해야 한다.
  const { login, logout } = useUserStore();
  const [currentPage, setCurrentPage] = useState<PageType>('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('Sarah');

  // ✅ 비밀번호 관련 상태
  const [fpStartStep, setFpStartStep] = useState<'find' | 'reset'>('find');
  const [fpPrefillEmail, setFpPrefillEmail] = useState<string | undefined>(undefined);

  // ✅ 설정에서 비밀번호 변경 눌렀을 때
  const goChangePasswordFromSettings = () => {
    setFpStartStep('reset');
    setFpPrefillEmail(localStorage.getItem('user_email') || undefined);
    setCurrentPage('forgotPassword');
  };

  // ✅ 로그인 화면에서 비밀번호 찾기 눌렀을 때
  const handleNavigateForgotPassword = () => {
    setFpStartStep('find');
    setFpPrefillEmail(undefined);
    setCurrentPage('forgotPassword');
  };

  // ✅ 테마 설정
  function setTheme(theme: Theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  setTheme(theme);

  // ✅ 로그인 처리
  const handleLogin = (name: string, email: string) => {
    console.log('Logging in with:', email);
    setIsLoggedIn(true);
    setCurrentPage('dashboard');
    // const name = email.split('@')[0];

    login({ name: name, email: email });

    // TODO: 삭제 예정 - 상태 관리로 대체
    // setUserName(name.charAt(0).toUpperCase() + name.slice(1));
  };

  // ✅ 회원가입 처리
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

  // ✅ 페이지 이동
  const handleNavigate = (page: string) => {
    if (
      page === 'dashboard' ||
      page === 'chat' ||
      page === 'profile' ||
      page === 'settings' ||
      page === 'diagnosis' ||
      page === 'survey' ||
      page === 'forgotPassword'
    ) {
      setCurrentPage(page as PageType);
    }
  };

  // ✅ 회원가입, 로그인 이동
  const handleNavigateSignup = () => setCurrentPage('signup');
  const handleNavigateLogin = () => setCurrentPage('login');

  // ✅ 로그아웃
  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentPage('login');
    setUserName('Sarah');
  };

  // ✅ 화면 렌더링
  const generatedComponent = useMemo(() => {
    // 로그인 전
    if (!isLoggedIn) {
      if (currentPage === 'signup') {
        return <SignupForm onSignup={handleSignup} onNavigateLogin={handleNavigateLogin} />;
      }

      if (currentPage === 'forgotPassword') {
        return (
          <ForgotPassword
            onNavigateLogin={handleNavigateLogin}
            startStep={fpStartStep}
            prefillEmail={fpPrefillEmail}
          />
        );
      }

      return (
        <>
          <BeautyAILogin
            onLogin={handleLogin}
            onNavigateSignup={handleNavigateSignup}
            onNavigateForgotPassword={handleNavigateForgotPassword}
          />
        </>
      );
    }

    // 로그인 후
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard userName={userName} onNavigate={handleNavigate} />;

      case 'diagnosis':
        return (
          <SkinDiagnosis
            onBack={() => setCurrentPage('dashboard')}
            onStart={() => setCurrentPage('survey')}
          />
        );

      case 'survey':
        return <Survey onDone={() => setCurrentPage('dashboard')} />;

      case 'chat':
        return <Chatbot userName={userName} onNavigate={handleNavigate} />;

      case 'profile':
        // return <UserProfile onNavigate={handleNavigate} onLogout={handleLogout} />;
        return <ProfilePage onNavigate={handleNavigate} onLogout={handleLogout} />;

      case 'settings':
        return (
          <Settings
            userName={userName}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            onChangePassword={goChangePasswordFromSettings} // ✅ 비밀번호 변경 연결
          />
        );

      case 'forgotPassword':
        return (
          <ForgotPassword
            onNavigateLogin={handleNavigateLogin}
            onNavigateSettings={() => setCurrentPage('settings')}
            startStep={fpStartStep}
            prefillEmail={fpPrefillEmail}
          />
        );

      default:
        return <Dashboard userName={userName} onNavigate={handleNavigate} />;
    }
  }, [currentPage, isLoggedIn, userName, fpStartStep, fpPrefillEmail]);

  // ✅ 컨테이너 스타일
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
