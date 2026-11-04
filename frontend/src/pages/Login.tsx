import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/api';
import {
  Briefcase,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle, loginWithDemoGoogle, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seededCredentials, setSeededCredentials] = useState<{
    email: string;
    password: string;
    hint: string;
  } | null>(null);

  // If already authenticated, redirect to dashboard or requested page
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Fetch seeded credentials hint for quick-fill assistance
  useEffect(() => {
    authApi
      .getSeededCredentials()
      .then((res) => {
        setSeededCredentials(res.data);
      })
      .catch(() => {
        // Fallback default if offline
        setSeededCredentials({
          email: 'admin@jobtracker.com',
          password: 'admin123',
          hint: 'Default Seeded User',
        });
      });
  }, []);

  const handleFillSeeded = () => {
    if (seededCredentials) {
      setEmail(seededCredentials.email);
      setPassword(seededCredentials.password);
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await login({ email: email.trim(), password });
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Invalid email or password. Only the single seeded account is authorized.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      setErrorMessage(null);
      await loginWithGoogle();
      // If demo fallback completed immediately without redirect:
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Google sign-in encountered an issue.');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-autumn-bg flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden select-none">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-autumn-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="bg-autumn-card/90 backdrop-blur-xl border border-autumn-card-border/80 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6">
          {/* Logo & Brand Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-tr from-autumn-primary to-autumn-secondary shadow-lg shadow-autumn-primary/25 mb-1 group transition-transform duration-300 hover:scale-105">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-autumn-text tracking-tight">
              CareerFlow
            </h1>
            <p className="text-xs sm:text-sm text-autumn-muted">
              Intelligent Job Tracking & Application Co-pilot
            </p>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs sm:text-sm animate-scale-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Google OAuth Button */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isSubmitting}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-autumn-card-border bg-autumn-surface hover:bg-autumn-surface-hover active:scale-[0.99] font-medium text-sm text-autumn-text transition-all duration-200 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-autumn-primary" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-autumn-card-border w-full" />
              <span className="bg-autumn-card px-3 text-[11px] font-semibold uppercase tracking-wider text-autumn-muted shrink-0">
                Or Sign In With Email
              </span>
              <div className="border-t border-autumn-card-border w-full" />
            </div>
          </div>

          {/* Seeded Quick Fill Hint Chip */}
          <div className="bg-autumn-primary/5 border border-autumn-primary/20 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all">
            <div className="flex items-center gap-2 text-xs text-autumn-text">
              <KeyRound className="w-4 h-4 text-autumn-primary shrink-0" />
              <div>
                <span className="font-semibold text-autumn-primary">Single Seeded User</span>
                <p className="text-[11px] text-autumn-muted">
                  {seededCredentials ? seededCredentials.email : 'admin@jobtracker.com'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFillSeeded}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-autumn-primary/10 hover:bg-autumn-primary/20 text-autumn-primary text-xs font-semibold transition-colors active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto Fill</span>
            </button>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-autumn-text">
                Email Address
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-autumn-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@jobtracker.com"
                  autoComplete="email"
                  required
                  className="block w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm bg-autumn-surface border border-autumn-card-border text-autumn-text placeholder-autumn-muted focus:outline-none focus:ring-2 focus:ring-autumn-primary/50 focus:border-autumn-primary transition-all duration-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-autumn-text">
                Password
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-autumn-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="block w-full pl-10 pr-10 py-2.5 rounded-xl text-sm bg-autumn-surface border border-autumn-card-border text-autumn-text placeholder-autumn-muted focus:outline-none focus:ring-2 focus:ring-autumn-primary/50 focus:border-autumn-primary transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-autumn-muted hover:text-autumn-text transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isGoogleLoading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-autumn-primary to-autumn-secondary hover:brightness-105 active:scale-[0.99] transition-all duration-200 shadow-md shadow-autumn-primary/25 disabled:opacity-50 disabled:pointer-events-none mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Explicit single-user policy notice (No Registration) */}
          <div className="pt-2 border-t border-autumn-card-border/60 text-center">
            <div className="inline-flex items-center justify-center gap-1.5 text-[11px] text-autumn-muted font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Single Authorized Portal • Registration is disabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

