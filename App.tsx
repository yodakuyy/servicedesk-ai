import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import React, { useState } from 'react';
import LoginSection from './components/LoginSection';
import VisualSection from './components/VisualSection';
import DepartmentSelection from './components/DepartmentSelection';
import Dashboard from './components/Dashboard';
import RequesterKBPortal from './components/RequesterKBPortal';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'login' | 'departments' | 'dashboard' | 'kb-portal'>('login');

  // Check URL hash for direct portal access
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#kb-portal' || window.location.hash === '#/kb-portal') {
        setCurrentView('kb-portal');
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  // KB Portal - Public access (no login required)
  if (currentView === 'kb-portal') {
    return <RequesterKBPortal />;
  }

  if (currentView === 'dashboard') {
    return (
      <Dashboard
        onLogout={() => setCurrentView('login')}
        onChangeDepartment={() => setCurrentView('departments')}
      />
    );
  }

  if (currentView === 'departments') {
    return (
      <DepartmentSelection
        onSelectDepartment={(deptId) => {
          console.log(`Selected department: ${deptId}`);
          setCurrentView('dashboard');
        }}
      />
    );
  }

  return (
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
  );
};



export default App;