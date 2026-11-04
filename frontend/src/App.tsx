import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import GoogleCallback from './pages/GoogleCallback';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import Favorites from './pages/Favorites';
import JobWatcher from './pages/JobWatcher';
import JobExtractor from './pages/JobExtractor';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import AIAssistant from './pages/AIAssistant';
import Settings from './pages/Settings';
import { Toaster } from './components/ui/toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/login/callback" element={<GoogleCallback />} />

            {/* Protected Application Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="applications" element={<Applications />} />
                <Route path="favorites" element={<Favorites />} />
                <Route path="watcher" element={<JobWatcher />} />
                <Route path="extractor" element={<JobExtractor />} />
                <Route path="analyzer" element={<ResumeAnalyzer />} />
                <Route path="assistant" element={<AIAssistant />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
