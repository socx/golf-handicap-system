import { createContext } from 'react';
import type { User } from '../lib/authStorage';

export interface AuthContextValue {
  user: User | null;
  role: User['role'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
