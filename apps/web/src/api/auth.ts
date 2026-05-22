import axios, { AxiosInstance } from 'axios';
import { clearTokens, getAccessToken, getRefreshToken, setTokens, type User } from '../lib/authStorage';

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005/api';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export const api: AxiosInstance = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const refreshToken = getRefreshToken();

    if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        setTokens(data.tokens.accessToken as string, data.tokens.refreshToken as string);
        originalRequest.headers.Authorization = `Bearer ${getAccessToken()}`;
        return api(originalRequest);
      } catch {
        clearTokens();
        window.location.href = '/auth/login';
      }
    }

    return Promise.reject(error);
  },
);

export const authApi = {
  register: (email: string, password: string, role: 'admin' | 'player' = 'player') =>
    api.post<{ user: User; tokens?: AuthTokens }>('/auth/register', { email, password, role }),
  login: (email: string, password: string) =>
    api.post<{ user: User; tokens: AuthTokens }>('/auth/login', { email, password }),
  logout: (refreshToken: string) =>
    api.post(
      '/auth/logout',
      { refreshToken },
      {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      },
    ),
  me: () => api.get<{ user: Omit<User, 'created_at'> }>('/auth/me'),
};

export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message || error.message || 'An error occurred';
  }

  return 'An unexpected error occurred';
};