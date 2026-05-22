// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadEnvFromRoot } = require('../../../../scripts/db/load-env');

loadEnvFromRoot();

const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();

export const env = {
  port: Number(process.env.API_PORT || process.env.PORT || 3005),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  cacheAdminKey: process.env.CACHE_ADMIN_KEY || '',
  dbUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db',
  appUrl: process.env.APP_URL || 'http://localhost:5175',
  authAutoLoginEnabled: String(process.env.AUTH_AUTO_LOGIN_ENABLED || 'true').toLowerCase() === 'true',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d',
  passwordResetTokenExpiryMinutes: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || 60),
  emailTransport: (process.env.EMAIL_TRANSPORT || (nodeEnv === 'production' ? 'smtp' : 'mailpit')).toLowerCase(),
  smtpHost: process.env.SMTP_HOST || 'localhost',
  smtpPort: Number(process.env.SMTP_PORT || 1025),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@localhost',
  smtpFromName: process.env.SMTP_FROM_NAME || 'Golf Handicap System',
  mailpitSmtpHost: process.env.MAILPIT_SMTP_HOST || 'localhost',
  mailpitSmtpPort: Number(process.env.MAILPIT_SMTP_PORT || 1025),
};
