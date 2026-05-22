import axios, { AxiosInstance } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3920/api';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'player' | 'viewer';
  is_active: boolean;
}

let accessToken = localStorage.getItem('ghs-access-token');
let refreshToken = localStorage.getItem('ghs-refresh-token');

export const api: AxiosInstance = axios.create({ baseURL: API_URL });

// Request interceptor: add access token
api.interceptors.request.use(config => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: handle 401, refresh token
api.interceptors.response.use(
  res => res,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        accessToken = data.tokens.accessToken as string;
        refreshToken = data.tokens.refreshToken as string;
        localStorage.setItem('ghs-access-token', accessToken);
        localStorage.setItem('ghs-refresh-token', refreshToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem('ghs-access-token');
        localStorage.removeItem('ghs-refresh-token');
        accessToken = null;
        refreshToken = null;
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('ghs-access-token', access);
  localStorage.setItem('ghs-refresh-token', refresh);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('ghs-access-token');
  localStorage.removeItem('ghs-refresh-token');
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

// Auth API
export const authApi = {
  register: (email: string, password: string, name: string) =>
    api.post<{ user: User; tokens?: AuthTokens }>('/auth/register', { email, password, name, role: 'player' }),
  login: (email: string, password: string) =>
    api.post<{ user: User; tokens: AuthTokens }>('/auth/login', { email, password }),
  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  me: () => api.get<{ user: Omit<User, 'created_at'> }>('/auth/me'),
};

export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message || error.message || 'An error occurred';
  }
  return 'An unexpected error occurred';
};
