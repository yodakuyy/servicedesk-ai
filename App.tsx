import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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

.prose img {
    cursor: pointer;
    transition: all 0.2s ease;
}

.prose img:hover {
    opacity: 0.8;
    transform: scale(0.995);
}
`;
document.head.appendChild(toastStyles);

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={
          <div className="min-h-screen w-full flex bg-white">
            <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-16 xl:p-24 overflow-y-auto">
              <LoginSection onLogin={() => navigate('/departments')} />
            </div>
            <div className="hidden lg:flex w-1/2 bg-brand-primary relative overflow-hidden items-center justify-center">
              <VisualSection />
            </div>
          </div>
        } />
        
        <Route path="/departments" element={
          <DepartmentSelection
            onSelectDepartment={(deptId) => {
              console.log(`Selected department: ${deptId}`);
              navigate('/dashboard');
            }}
          />
        } />

        <Route path="/dashboard/*" element={
          <Dashboard
            onLogout={() => navigate('/login')}
            onChangeDepartment={() => navigate('/departments')}
          />
        } />

        <Route path="/kb-portal" element={
          <RequesterKBPortal onClose={() => navigate('/login')} />
        } />

        <Route path="/presentation" element={
          <PresentationView onExit={() => navigate('/login')} />
        } />

        {/* Default Redirects */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ToastProvider>
  );
};

export default App;