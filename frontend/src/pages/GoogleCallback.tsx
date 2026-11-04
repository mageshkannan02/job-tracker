import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Briefcase, Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

export const GoogleCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleGoogleCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const authError = searchParams.get('error');

    if (authError) {
      setError(`Google authorization was denied or canceled: ${authError}`);
      return;
    }

    if (!code) {
      setError('No authorization code was found in the Google callback URL.');
      return;
    }

    let isMounted = true;
    handleGoogleCallback(code)
      .then(() => {
        if (isMounted) {
          navigate('/dashboard', { replace: true });
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || 'Failed to complete Google authentication');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [searchParams, handleGoogleCallback, navigate]);

  return (
    <div className="min-h-screen bg-autumn-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-autumn-card border border-autumn-card-border rounded-2xl shadow-xl p-8 text-center animate-scale-in">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-autumn-primary to-autumn-secondary flex items-center justify-center shadow-lg shadow-autumn-primary/20 mx-auto mb-5">
          <Briefcase className="w-7 h-7 text-white" />
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="inline-flex p-3 rounded-full bg-red-500/10 text-red-500 mb-2">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-autumn-text">Authentication Error</h2>
            <p className="text-sm text-autumn-muted bg-autumn-surface p-3.5 rounded-xl border border-autumn-card-border break-words">
              {error}
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-autumn-primary text-white text-sm font-semibold hover:bg-autumn-primary-hover transition-colors shadow-md shadow-autumn-primary/20"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Login
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-autumn-text">Signing in with Google</h2>
            <p className="text-sm text-autumn-muted">
              Securing your session and redirecting you to your workspace...
            </p>
            <div className="flex justify-center pt-3">
              <Loader2 className="w-8 h-8 animate-spin text-autumn-primary" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleCallback;

