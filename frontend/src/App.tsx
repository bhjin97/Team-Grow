import { useState, useMemo } from 'react';
import { Container, Theme } from './settings/types';
import { BeautyAILogin } from './components/BeautyAILogin';
import SignupForm from './components/SignupForm';
import Dashboard from './components/dashboard/Dashboard';
import ChatInterface from './components/ChatInterface';
import UserProfile from './components/UserProfile';
import Settings from './components/Settings';

let theme: Theme = 'light';
// only use 'centered' container for standalone components, never for full page apps or websites.
let container: Container = 'none';

type PageType = 'login' | 'signup' | 'dashboard' | 'chat' | 'profile' | 'settings';

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
    // Simulate login - in real app, this would call an API
    console.log('Logging in with:', email);
    setIsLoggedIn(true);
    setCurrentPage('dashboard');
    
    // Extract name from email for demo purposes
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
    // Simulate signup - in real app, this would call an API
    console.log('Signing up with:', userData);
    setIsLoggedIn(true);
    setCurrentPage('dashboard');
    
    // Use full name from signup data
    const firstName = userData.fullName.split(' ')[0];
    setUserName(firstName);
  };

  const handleNavigate = (page: string) => {
    if (page === 'dashboard' || page === 'chat' || page === 'profile' || page === 'settings') {
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
    // THIS IS WHERE THE TOP LEVEL GENRATED COMPONENT WILL BE RETURNED!
    if (!isLoggedIn) {
      if (currentPage === 'signup') {
        return <SignupForm onSignup={handleSignup} onNavigateLogin={handleNavigateLogin} />;
      }
      return <BeautyAILogin onLogin={handleLogin} onNavigateSignup={handleNavigateSignup} />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard userName={userName} onNavigate={handleNavigate} />;
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