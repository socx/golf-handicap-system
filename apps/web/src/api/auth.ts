import { api } from './client';
import { type User } from '../lib/authStorage';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface NotificationPreferences {
  handicap_updates_enabled: boolean;
  round_submitted_enabled: boolean;
  round_approved_enabled: boolean;
  marketing_enabled: boolean;
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
  getNotificationPreferences: () =>
    api.get<{ preferences: NotificationPreferences }>('/auth/preferences'),
  updateNotificationPreferences: (prefs: Partial<NotificationPreferences>) =>
    api.patch<{ preferences: NotificationPreferences }>('/auth/preferences', prefs),
  updateProfile: (email: string) =>
    api.patch<{ email: string }>('/auth/profile', { email }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch<{ message: string }>('/auth/password', { currentPassword, newPassword }),
};