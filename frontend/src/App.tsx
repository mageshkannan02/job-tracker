import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout from './components/layout/Layout';
import { Toaster } from './components/ui/toast';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import appLogo from './assets/app-logo.png';

// Code-split pages with React.lazy for lightweight initial mobile bundle and fast loading
const Login = lazy(() => import('./pages/Login'));
const GoogleCallback = lazy(() => import('./pages/GoogleCallback'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Applications = lazy(() => import('./pages/Applications'));
const Favorites = lazy(() => import('./pages/Favorites'));
const JobWatcher = lazy(() => import('./pages/JobWatcher'));
const JobExtractor = lazy(() => import('./pages/JobExtractor'));
const ResumeAnalyzer = lazy(() => import('./pages/ResumeAnalyzer'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const Settings = lazy(() => import('./pages/Settings'));

const PageLoader: React.FC = () => (
  <div className="flex h-[45vh] w-full flex-col items-center justify-center gap-2.5">
    <img
      src={appLogo}
      alt="Loading..."
      className="h-9 w-9 animate-app-logo-loading object-contain"
    />
    <p className="text-xs font-medium text-muted-foreground animate-pulse">Loading...</p>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
