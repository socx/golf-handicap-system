import { api } from './client';
import { type User } from '../lib/authStorage';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export const authApi = {
  register: (email: string, password: string, role: 'admin' | 'player' = 'player') =>
    api.post<{ user: User; message: string }>('/auth/register', { email, password, role }),
  login: (email: string, password: string) =>
    api.post<{ user: User; tokens: AuthTokens }>('/auth/login', { email, password }),
  activateAccount: (token: string) =>
    api.post<{ message: string; user: User }>('/auth/activate', { token }),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  me: () => api.get<{ user: Omit<User, 'created_at'> }>('/auth/me'),
};