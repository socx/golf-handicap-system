export interface RawEnv {
  API_PORT?: string;
  PORT?: string;
  REDIS_URL?: string;
  DATABASE_URL?: string;
  APP_URL?: string;
  SELF_REGISTRATION_ENABLED?: string;
  AUTO_APPROVE_ROUNDS?: string;
  ACCOUNT_ACTIVATION_TOKEN_EXPIRY_HOURS?: string;
  AUTH_AUTO_LOGIN_ENABLED?: string;
  JWT_SECRET?: string;
  JWT_ACCESS_TOKEN_EXPIRES_IN?: string;
  JWT_REFRESH_TOKEN_EXPIRES_IN?: string;
  PASSWORD_RESET_TOKEN_EXPIRES_IN?: string;
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES?: string;
  EMAIL_TRANSPORT?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
  MAILPIT_SMTP_HOST?: string;
  MAILPIT_SMTP_PORT?: string;
  SENDGRID_API_KEY?: string;
  SES_REGION?: string;
}

function toPositiveNumber(value: string | undefined, fallback: number, label: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid environment variable ${label}: expected a positive number`);
  }
  return parsed;
}

function toBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
}

export function validateAndNormalizeEnv(raw: RawEnv) {
  const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();
  const emailTransport = (raw.EMAIL_TRANSPORT || (nodeEnv === 'production' ? 'smtp' : 'mailpit')).toLowerCase();

  if (!['mailpit', 'smtp', 'sendgrid', 'ses'].includes(emailTransport)) {
    throw new Error('Invalid environment variable EMAIL_TRANSPORT: expected one of mailpit, smtp, sendgrid, ses');
  }

  return {
    port: toPositiveNumber(raw.API_PORT || raw.PORT, 3005, 'API_PORT/PORT'),
    redisUrl: raw.REDIS_URL || 'redis://127.0.0.1:6379',
    cacheAdminKey: process.env.CACHE_ADMIN_KEY || '',
    dbUrl: raw.DATABASE_URL || 'postgresql://localhost:5432/golf_db',
    appUrl: raw.APP_URL || 'http://localhost:5175',
    selfRegistrationEnabled: toBoolean(raw.SELF_REGISTRATION_ENABLED, false),
    autoApproveRounds: toBoolean(raw.AUTO_APPROVE_ROUNDS, false),
    accountActivationTokenExpiryHours: toPositiveNumber(raw.ACCOUNT_ACTIVATION_TOKEN_EXPIRY_HOURS, 24, 'ACCOUNT_ACTIVATION_TOKEN_EXPIRY_HOURS'),
    authAutoLoginEnabled: toBoolean(raw.AUTH_AUTO_LOGIN_ENABLED, true),
    jwtSecret: raw.JWT_SECRET || 'dev-jwt-secret-change-me',
    jwtAccessExpiresIn: raw.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: raw.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d',
    passwordResetTokenExpiryMinutes: toPositiveNumber(
      raw.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || raw.PASSWORD_RESET_TOKEN_EXPIRES_IN,
      60,
      'PASSWORD_RESET_TOKEN_EXPIRY_MINUTES',
    ),
    emailTransport,
    smtpHost: raw.SMTP_HOST || 'localhost',
    smtpPort: toPositiveNumber(raw.SMTP_PORT, 1025, 'SMTP_PORT'),
    smtpUser: raw.SMTP_USER || '',
    smtpPassword: raw.SMTP_PASSWORD || '',
    smtpFromEmail: raw.SMTP_FROM_EMAIL || 'noreply@localhost',
    smtpFromName: raw.SMTP_FROM_NAME || 'Golf Handicap System',
    mailpitSmtpHost: raw.MAILPIT_SMTP_HOST || 'localhost',
    mailpitSmtpPort: toPositiveNumber(raw.MAILPIT_SMTP_PORT, 1025, 'MAILPIT_SMTP_PORT'),
    sendgridApiKey: raw.SENDGRID_API_KEY || '',
    sesRegion: raw.SES_REGION || 'eu-west-2',
  };
}
