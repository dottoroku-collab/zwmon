import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Toaster } from 'sonner';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import TicketListPage from './pages/TicketListPage';
import TicketDetailPage from './pages/TicketDetailPage';
import CreateTicketPage from './pages/CreateTicketPage';
import UserManagementPage from './pages/UserManagementPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import RestitutionPage from './pages/RestitutionPage';
import RestitutionReportPage from './pages/RestitutionReportPage';
import SLACompliancePage from './pages/SLACompliancePage';
import MonitoringPage from './pages/MonitoringPage';
import LogbookPage from './pages/LogbookPage';
import ServicePointsPage from './pages/ServicePointsPage';
import ProfilePage from './pages/ProfilePage';
import ChatPage from './pages/ChatPage';
import LiveCCTVPage from './pages/LiveCCTVPage'; // 1. Tambahkan import ini
import Layout from './components/Layout';
import './App.css';

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useApp();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />
      
      <Route path="/tickets" element={
        <ProtectedRoute>
          <TicketListPage />
        </ProtectedRoute>
      } />
      
<Route path="/live-cctv" element={
        <ProtectedRoute roles={['admin', 'am', 'helpdesk', 'eos']}>
          <LiveCCTVPage />
        </ProtectedRoute>
      } />

      <Route path="/tickets/create" element={
        <ProtectedRoute roles={['client', 'helpdesk']}>
          <CreateTicketPage />
        </ProtectedRoute>
      } />
      
      <Route path="/tickets/:id" element={
        <ProtectedRoute>
          <TicketDetailPage />
        </ProtectedRoute>
      } />
      
      <Route path="/tickets/:id/logbook" element={
        <ProtectedRoute roles={['eos']}>
          <LogbookPage />
        </ProtectedRoute>
      } />
      
      <Route path="/users" element={
        <ProtectedRoute roles={['admin']}>
          <UserManagementPage />
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute roles={['admin']}>
          <SettingsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/reports" element={
        <ProtectedRoute roles={['admin', 'am', 'helpdesk']}>
          <ReportsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/restitution" element={
        <ProtectedRoute roles={['admin', 'am']}>
          <RestitutionPage />
        </ProtectedRoute>
      } />
      
      <Route path="/restitution-report" element={
        <ProtectedRoute roles={['admin', 'am']}>
          <RestitutionReportPage />
        </ProtectedRoute>
      } />
      
      <Route path="/sla" element={
        <ProtectedRoute roles={['admin', 'am']}>
          <SLACompliancePage />
        </ProtectedRoute>
      } />
      
      <Route path="/monitoring" element={
        <ProtectedRoute roles={['admin', 'am', 'helpdesk', 'eos']}>
          <MonitoringPage />
        </ProtectedRoute>
      } />
      
      <Route path="/service-points" element={
        <ProtectedRoute roles={['admin']}>
          <ServicePointsPage />
        </ProtectedRoute>
      } />
      
      <Route path="/profile" element={
        <ProtectedRoute>
          <ProfilePage />
        </ProtectedRoute>
      } />
      
      <Route path="/chat" element={
        <ProtectedRoute>
          <ChatPage />
        </ProtectedRoute>
      } />
      
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
        <ThemedToaster />
      </BrowserRouter>
    </AppProvider>
  );
}

function ThemedToaster() {
  const { theme } = useApp();
  return (
    <Toaster 
      position="top-right" 
      toastOptions={{
        style: theme === 'light' ? {
          background: '#ffffff',
          color: '#1e293b',
          border: '1px solid #e2e8f0',
        } : {
          background: '#1e293b',
          color: '#f8fafc',
          border: '1px solid rgba(255,255,255,0.1)',
        },
      }}
    />
  );
}

export default App;
