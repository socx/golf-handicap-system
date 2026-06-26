/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';

export type ThemeMode = 'light' | 'dark';
type ThemePreference = ThemeMode | 'system';

interface ThemeContextValue {
  theme: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

const THEME_STORAGE_KEY = 'ghs-theme-mode';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function resolveThemePreference(preference: ThemePreference): ThemeMode {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    let cancelled = false;
    const loadPreference = async () => {
      try {
        const response = await authApi.getNotificationPreferences();
        if (cancelled) return;
        const preference = response.data.preferences.theme_mode;
        if (preference === 'light' || preference === 'dark' || preference === 'system') {
          setThemeState(resolveThemePreference(preference));
        }
      } catch {
        // Ignore failures for unauthenticated state.
      }
    };

    void loadPreference();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggleTheme: () => {
        setThemeState((current) => {
          const next = current === 'dark' ? 'light' : 'dark';
          void authApi.updateNotificationPreferences({ theme_mode: next }).catch(() => undefined);
          return next;
        });
      },
      setTheme: (nextTheme) => {
        setThemeState(nextTheme);
        void authApi.updateNotificationPreferences({ theme_mode: nextTheme }).catch(() => undefined);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export default ThemeProvider;