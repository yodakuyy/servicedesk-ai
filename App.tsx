import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import React, { useState } from 'react';
import LoginSection from './components/LoginSection';
import VisualSection from './components/VisualSection';
import DepartmentSelection from './components/DepartmentSelection';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'login' | 'departments' | 'dashboard'>('login');

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