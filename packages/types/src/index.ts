export interface User {
  id: string;
  email: string;
  password_hash?: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface JWTClaims {
  sub: string;
  role: string;
  tokenType: 'access' | 'refresh';
  jti?: string;
  exp?: number;
  iat?: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  errors: ValidationError[];
  value: T;
}

export interface HealthStatusResponse {
  status: 'ok' | 'error';
  service: string;
  timestamp: string;
}

export interface WorkerHeartbeatEvent {
  service: 'ghs-worker';
  event: 'started' | 'heartbeat' | 'shutdown';
  timestamp: string;
  intervalMs: number;
  signal?: NodeJS.Signals;
}
