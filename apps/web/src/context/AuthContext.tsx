import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import { setAuthFailureHandler } from '../api/client';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  setAccessToken,
  setStoredUser,
  setTokens,
  type User,
} from '../lib/authStorage';
import { AuthContext, type AuthContextValue } from './auth-context';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState(true);

  const clearAuthState = useCallback(() => {
    clearTokens();
    setStoredUser(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const hasAnyToken = Boolean(getAccessToken() || getRefreshToken());

    if (!hasAnyToken) {
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await authApi.me();
      setUser(data.user as User);
      setStoredUser(data.user as User);
    } catch {
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  }, [clearAuthState]);

  useEffect(() => {
    setAuthFailureHandler(() => {
      clearAuthState();
      setIsLoading(false);
    });

    const loadTimer = window.setTimeout(() => {
      void refreshUser();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
      setAuthFailureHandler(null);
    };
  }, [clearAuthState, refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    setTokens(data.tokens.accessToken, data.tokens.refreshToken);
    setUser(data.user);
    setStoredUser(data.user);
    setIsLoading(false);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken();

    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } finally {
      clearAuthState();
      setAccessToken(null);
    }
  }, [clearAuthState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? null,
      isAuthenticated: Boolean(user && (getAccessToken() || getRefreshToken())),
      isLoading,
      login,
      logout,
      refreshUser,
    }),
    [isLoading, login, logout, refreshUser, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

