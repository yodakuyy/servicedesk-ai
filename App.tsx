import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import React, { useState } from 'react';
import LoginSection from './components/LoginSection';
import VisualSection from './components/VisualSection';
import DepartmentSelection from './components/DepartmentSelection';
import Dashboard from './components/Dashboard';
import RequesterKBPortal from './components/RequesterKBPortal';
import PresentationView from './components/PresentationView';
import { ToastProvider } from './components/ToastProvider';

// Toast animation styles
const toastStyles = document.createElement('style');
toastStyles.textContent = `
@keyframes slide-in-right {
    from {
        transform: translateX(100%) scale(0.95);
        opacity: 0;
    }
    to {
        transform: translateX(0) scale(1);
        opacity: 1;
    }
}

@keyframes progress {
    from {
        width: 100%;
    }
    to {
        width: 0%;
    }
}

.animate-slide-in-right {
    animation: slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-progress {
    animation: progress linear forwards;
}
`;
document.head.appendChild(toastStyles);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'login' | 'departments' | 'dashboard' | 'kb-portal' | 'presentation'>('login');
  const [dashboardInitialView, setDashboardInitialView] = useState<string | undefined>(undefined);

  // Check URL hash for direct portal access and deep linking
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash === '#kb-portal' || hash === '#/kb-portal') {
        setCurrentView('kb-portal');
      } else if (hash === '#dashboard/tickets') {
        setDashboardInitialView('user-dashboard');
        setCurrentView('dashboard');
      } else if (hash === '#presentation') {
        setCurrentView('presentation');
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // KB Portal - Public access (no login required)
  if (currentView === 'kb-portal') {
    return (
      <ToastProvider>
        <RequesterKBPortal />
      </ToastProvider>
    );
  }

  if (currentView === 'presentation') {
    return (
      <PresentationView onExit={() => {
        window.location.hash = '';
        setCurrentView('login');
      }} />
    );
  }

  if (currentView === 'dashboard') {
    return (
      <ToastProvider>
        <Dashboard
          onLogout={() => setCurrentView('login')}
          onChangeDepartment={() => setCurrentView('departments')}
          initialView={dashboardInitialView}
        />
      </ToastProvider>
    );
  }

  if (currentView === 'departments') {
    return (
      <ToastProvider>
        <DepartmentSelection
          onSelectDepartment={(deptId) => {
            console.log(`Selected department: ${deptId}`);
            setCurrentView('dashboard');
          }}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen w-full flex bg-white">
        {/* Left Side - Login Form */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-16 xl:p-24 overflow-y-auto">
          <LoginSection onLogin={() => setCurrentView('departments')} />
        </div>

        {/* Right Side - Visuals (Hidden on mobile) */}
        <div className="hidden lg:flex w-1/2 bg-brand-primary relative overflow-hidden items-center justify-center">
          <VisualSection />
        </div>
      </div>
    </ToastProvider>
  );
};



export default App;