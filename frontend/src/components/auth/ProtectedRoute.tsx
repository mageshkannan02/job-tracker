import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Briefcase, Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-autumn-bg flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-autumn-primary to-autumn-secondary flex items-center justify-center shadow-lg shadow-autumn-primary/20">
            <Briefcase className="w-7 h-7 text-white animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-autumn-muted text-sm font-medium mt-2">
            <Loader2 className="w-4 h-4 animate-spin text-autumn-primary" />
            <span>Verifying session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

