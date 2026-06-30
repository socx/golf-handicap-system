export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'player' | 'viewer';
  is_active: boolean;
  is_super_admin?: boolean;
  player_id?: string | null;
  impersonated_by?: string | null;
  original_user_id?: string | null;
}

const REFRESH_TOKEN_KEY = 'ghs-refresh-token';
const USER_KEY = 'ghs-user';

let accessToken: string | null = null;
let refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const setAccessToken = (access: string | null) => {
  accessToken = access;
};

export const getAccessToken = () => accessToken;

export const getRefreshToken = () => refreshToken;

export const setStoredUser = (user: User | null) => {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }

  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getStoredUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
};