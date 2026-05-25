import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '../lib/authStorage';
import { showErrorToast } from '../lib/toast';

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005/api';

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let authFailureHandler: (() => void) | null = null;

export const setAuthFailureHandler = (handler: (() => void) | null) => {
  authFailureHandler = handler;
};

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
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const refreshToken = getRefreshToken();

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && refreshToken) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post<{ tokens: { accessToken: string; refreshToken: string } }>(
          `${API_URL}/auth/refresh`,
          { refreshToken },
        );
        setTokens(data.tokens.accessToken, data.tokens.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.tokens.accessToken}`;
        return api(originalRequest);
      } catch {
        clearTokens();
        authFailureHandler?.();
        showErrorToast('Session expired', 'Your session expired. Please sign in again.');
      }
    }

    if (error.code !== 'ERR_CANCELED') {
      const apiError = normalizeApiError(error);
      showErrorToast('Request failed', apiError.message);
    }

    return Promise.reject(error);
  },
);

interface ApiErrorPayload {
  error?: {
    message?: string;
    code?: string;
  };
  message?: string;
}

export interface StandardApiError {
  message: string;
  status?: number;
  code?: string;
}

export const normalizeApiError = (error: unknown): StandardApiError => {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return {
      message: error.response?.data?.error?.message || error.response?.data?.message || error.message || 'An error occurred',
      status: error.response?.status,
      code: error.response?.data?.error?.code,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: 'An unexpected error occurred' };
};

export const handleApiError = (error: unknown): string => normalizeApiError(error).message;
