import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials } from '@/types';
import { authApi } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  loginWithGoogle: () => Promise<void>;
  loginWithDemoGoogle: (data?: { name?: string; email?: string }) => Promise<User>;
  handleGoogleCallback: (code: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate stored token and fetch user details on initial mount
  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        if (mounted) setIsLoading(false);
        return;
      }
      try {
        const res = await authApi.getMe();
        if (mounted) {
          const userData = (res.data as any)?.user || res.data;
          setUser(userData);
          setToken(storedToken);
        }
      } catch (err) {
        // Token is invalid, expired, or server restarted with new secret
        console.warn('Session verification failed, resetting token', err);
        localStorage.removeItem(TOKEN_KEY);
        if (mounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<User> => {
    const res = await authApi.login(credentials);
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const loginWithGoogle = useCallback(async (): Promise<void> => {
    const res = await authApi.getGoogleAuthUrl();
    if (res.data.configured && res.data.auth_url) {
      // Redirect to Google OAuth consent screen
      window.location.href = res.data.auth_url;
    } else {
      // If Google OAuth Client ID is not configured, fallback smoothly to demo Google sign-in
      const demoRes = await authApi.googleDemoLogin();
      localStorage.setItem(TOKEN_KEY, demoRes.data.token);
      setToken(demoRes.data.token);
      setUser(demoRes.data.user);
    }
  }, []);

  const loginWithDemoGoogle = useCallback(async (data?: { name?: string; email?: string }): Promise<User> => {
    const res = await authApi.googleDemoLogin(data);
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const handleGoogleCallback = useCallback(async (code: string): Promise<User> => {
    const res = await authApi.googleCallback(code);
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout request errors
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    loginWithGoogle,
    loginWithDemoGoogle,
    handleGoogleCallback,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

