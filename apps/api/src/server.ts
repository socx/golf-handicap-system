import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { createClient } from 'redis';
import nodemailer from 'nodemailer';
import type { AuthTokens, JWTClaims, User, ValidationError, ValidationResult } from '@ghs/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadEnvFromRoot } = require('../../../scripts/db/load-env');

loadEnvFromRoot();

const port = Number(process.env.API_PORT || process.env.PORT || 3005);

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const cacheAdminKey = process.env.CACHE_ADMIN_KEY || '';
const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/golf_db';
const authAutoLoginEnabled = String(process.env.AUTH_AUTO_LOGIN_ENABLED || 'true').toLowerCase() === 'true';
const jwtSecret = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const jwtAccessExpiresIn = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || '15m';
const jwtRefreshExpiresIn = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || '30d';
const nodeEnv = (process.env.NODE_ENV || 'development').toLowerCase();

// SMTP / email config
const smtpHost = process.env.SMTP_HOST || 'localhost';
const smtpPort = Number(process.env.SMTP_PORT || 1025);
const smtpUser = process.env.SMTP_USER || '';
const smtpPassword = process.env.SMTP_PASSWORD || '';
const smtpFromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@localhost';
const smtpFromName = process.env.SMTP_FROM_NAME || 'Golf Handicap System';
const mailpitSmtpHost = process.env.MAILPIT_SMTP_HOST || 'localhost';
const mailpitSmtpPort = Number(process.env.MAILPIT_SMTP_PORT || 1025);
const emailTransport = (process.env.EMAIL_TRANSPORT || (nodeEnv === 'production' ? 'smtp' : 'mailpit')).toLowerCase();
const passwordResetTokenExpiryMinutes = Number(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES || 60);

function createMailTransport() {
  if (emailTransport === 'mailpit') {
    // Mailpit local SMTP (no auth, plain SMTP on port 1025)
    return nodemailer.createTransport({ host: mailpitSmtpHost, port: mailpitSmtpPort, secure: false, auth: undefined });
  }
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword },
  });
}

// Types
interface CacheTTL {
  dashboard: number;
  leaderboard: number;
  settings: number;
}

interface CacheKeys {
  dashboard: Set<string>;
  leaderboard: Set<string>;
  settings: Set<string>;
}

interface CacheResult<T> {
  cacheHit: boolean;
  key: string;
  ttl: number;
  value: T;
}

interface LogRequest {
  requestId: string;
  req: http.IncomingMessage;
  statusCode: number;
  durationMs: number;
}

// RBAC Types
type UserRole = 'admin' | 'player' | 'viewer';

interface AuthenticatedRequest {
  userId: string;
  role: UserRole;
  claims: JWTClaims;
}

interface RBACMiddlewareResult {
  success: boolean;
  auth?: AuthenticatedRequest;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

interface RequireRoleOptions {
  requiredRoles: UserRole[];
}

type AuthAuditEventType =
  | 'auth_login_success'
  | 'auth_login_failure'
  | 'auth_logout'
  | 'auth_refresh'
  | 'auth_user_activated'
  | 'auth_user_deactivated'
  | 'auth_user_deleted'
  | 'auth_password_reset_requested'
  | 'auth_password_reset_completed';

const ttlByResource: CacheTTL = {
  dashboard: Number(process.env.CACHE_TTL_DASHBOARD_SECONDS || 60),
  leaderboard: Number(process.env.CACHE_TTL_LEADERBOARD_SECONDS || 45),
  settings: Number(process.env.CACHE_TTL_SETTINGS_SECONDS || 300),
};

const cacheKeysByResource: CacheKeys = {
  dashboard: new Set(),
  leaderboard: new Set(),
  settings: new Set(),
};

const redisClient = createClient({ url: redisUrl });
const dbPool = new Pool({ connectionString: dbUrl });
const localRevokedRefreshTokenDigests = new Map<string, number>();

let redisReady = false;

redisClient.on('ready', () => {
  redisReady = true;
  console.log('[cache] redis connected');
});

redisClient.on('error', (error: Error) => {
  redisReady = false;
  console.error('[cache] redis error:', error.message);
});

redisClient.connect().catch((error: Error) => {
  redisReady = false;
  console.warn('[cache] running without redis:', error.message);
});

function sendJson(res: http.ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendError(
  res: http.ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  details?: ValidationError[],
): void {
  const errorBody: Record<string, unknown> = {
    error: {
      code,
      message,
    },
  };

  if (details) {
    (errorBody.error as Record<string, unknown>).details = details;
  }

  sendJson(res, statusCode, errorBody);
}

function normalizeRequestId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return crypto.randomUUID();
  }
  return value.trim().slice(0, 128);
}

function logRequest({ requestId, req, statusCode, durationMs }: LogRequest): void {
  const userId = typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : null;
  const logLine = {
    level: 'info',
    event: 'http_request',
    service: 'ghs-api',
    requestId,
    userId,
    method: (req.method || 'GET').toUpperCase(),
    path: req.url || '/',
    statusCode,
    durationMs,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(logLine));
}

function parseUrl(req: http.IncomingMessage): URL {
  const host = req.headers.host || `localhost:${port}`;
  return new URL(req.url || '/', `http://${host}`);
}

function getClientIp(req: http.IncomingMessage): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim().length > 0) {
    return realIp.trim();
  }

  return req.socket.remoteAddress || 'unknown';
}

function buildCacheKey(resource: keyof CacheTTL, requestUrl: URL): string {
  const params = [...requestUrl.searchParams.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const digest = crypto.createHash('sha1').update(params).digest('hex').slice(0, 12);
  return `ghs:cache:${resource}:${digest}`;
}

async function getOrSetCache<T>({
  resource,
  requestUrl,
  computeValue,
}: {
  resource: keyof CacheTTL;
  requestUrl: URL;
  computeValue: () => Promise<T>;
}): Promise<CacheResult<T>> {
  const ttl = Math.max(1, Number(ttlByResource[resource] || 60));
  const key = buildCacheKey(resource, requestUrl);

  if (redisReady) {
    const cached = await redisClient.get(key);
    if (cached) {
      return {
        cacheHit: true,
        key,
        ttl,
        value: JSON.parse(cached) as T,
      };
    }
  }

  const value = await computeValue();

  if (redisReady) {
    await redisClient.set(key, JSON.stringify(value), { EX: ttl });
    cacheKeysByResource[resource].add(key);
  }

  return {
    cacheHit: false,
    key,
    ttl,
    value,
  };
}

async function invalidateCache(resource: 'all' | 'dashboard' | 'leaderboard' | 'settings'): Promise<{
  invalidated: number;
  redisReady: boolean;
}> {
  if (!redisReady) {
    return { invalidated: 0, redisReady: false };
  }

  const targets: Array<keyof CacheTTL> = resource === 'all'
    ? ['dashboard', 'leaderboard', 'settings']
    : [resource];

  let invalidated = 0;

  for (const target of targets) {
    const keys = [...cacheKeysByResource[target]];
    if (keys.length > 0) {
      const deleted = await redisClient.del(keys);
      invalidated += Number(deleted || 0);
      cacheKeysByResource[target].clear();
    }
  }

  return { invalidated, redisReady: true };
}

function buildDashboardSummary(): Record<string, unknown> {
  return {
    activePlayers: 42,
    roundsToday: 18,
    averageHandicap: 14.7,
    generatedAt: new Date().toISOString(),
  };
}

function buildLeaderboardSummary(url: URL): Record<string, unknown> {
  const clubId = url.searchParams.get('clubId') || 'all';
  return {
    clubId,
    leaders: [
      { playerId: 'p-001', name: 'Player One', points: 128 },
      { playerId: 'p-002', name: 'Player Two', points: 121 },
      { playerId: 'p-003', name: 'Player Three', points: 115 },
    ],
    generatedAt: new Date().toISOString(),
  };
}

function buildSettingsSummary(): Record<string, unknown> {
  return {
    locale: 'en-GB',
    timezone: 'Europe/London',
    featureFlags: {
      leaderboardLiveUpdates: true,
      aiAssistant: false,
    },
    generatedAt: new Date().toISOString(),
  };
}

function readJsonBody(
  req: http.IncomingMessage,
  maxBytes: number = 1024 * 1024,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > maxBytes) {
        reject(new Error('Request body too large'));
      }
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', (error: Error) => reject(error));
  });
}

function validateRegistrationInput(
  payload: Record<string, unknown>,
): ValidationResult<{ email: string; password: string; role: string }> {
  const errors: ValidationError[] = [];
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const role = typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : 'player';

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Email must be a valid address' });
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
  }

  if (!['player', 'admin'].includes(role)) {
    errors.push({ field: 'role', message: 'Role must be one of: player, admin' });
  }

  return {
    errors,
    value: {
      email,
      password,
      role,
    },
  };
}

function buildAuthTokens(user: User): AuthTokens {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, tokenType: 'access' },
    jwtSecret,
    { expiresIn: jwtAccessExpiresIn } as any,
  );

  const refreshJti = crypto.randomUUID();
  const refreshToken = jwt.sign(
    { sub: user.id, role: user.role, tokenType: 'refresh', jti: refreshJti },
    jwtSecret,
    { expiresIn: jwtRefreshExpiresIn } as any,
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: jwtAccessExpiresIn,
  };
}

async function registerUser(payload: { email: string; password: string; role: string }): Promise<User> {
  const passwordHash = await bcrypt.hash(payload.password, 12);
  const query = `
    INSERT INTO users (email, password_hash, role, is_active)
    VALUES ($1, $2, $3, TRUE)
    RETURNING id, email::text AS email, role, is_active, created_at, updated_at
  `;

  const result = await dbPool.query(query, [payload.email, passwordHash, payload.role]);
  return result.rows[0] as User;
}

function validateLoginInput(
  payload: Record<string, unknown>,
): ValidationResult<{ email: string; password: string }> {
  const errors: ValidationError[] = [];
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  }

  return {
    errors,
    value: {
      email,
      password,
    },
  };
}

async function findUserByEmail(email: string): Promise<User | null> {
  const query = `
    SELECT id, email::text AS email, password_hash, role, is_active, created_at, updated_at
    FROM users
    WHERE email = $1 AND deleted_at IS NULL
    LIMIT 1
  `;
  const result = await dbPool.query(query, [email]);
  return (result.rows[0] as User | undefined) || null;
}

async function findUserById(id: string): Promise<User | null> {
  const query = `
    SELECT id, email::text AS email, role, is_active, created_at, updated_at
    FROM users
    WHERE id = $1 AND deleted_at IS NULL
    LIMIT 1
  `;
  const result = await dbPool.query(query, [id]);
  return (result.rows[0] as User | undefined) || null;
}

async function setUserActivationStatus(id: string, isActive: boolean): Promise<User | null> {
  const query = `
    UPDATE users
    SET is_active = $2, updated_at = NOW()
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id, email::text AS email, role, is_active, created_at, updated_at
  `;

  const result = await dbPool.query(query, [id, isActive]);
  return (result.rows[0] as User | undefined) || null;
}

async function softDeleteUserById(id: string): Promise<User | null> {
  const query = `
    UPDATE users
    SET deleted_at = NOW(), updated_at = NOW(), is_active = FALSE
    WHERE id = $1 AND deleted_at IS NULL
    RETURNING id, email::text AS email, role, is_active, created_at, updated_at
  `;

  const result = await dbPool.query(query, [id]);
  return (result.rows[0] as User | undefined) || null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseUserActivationRoute(path: string): { userId: string; action: 'activate' | 'deactivate' } | null {
  const match = path.match(/^\/(?:api\/)?users\/([0-9a-fA-F-]+)\/(activate|deactivate)$/);
  if (!match) {
    return null;
  }

  const userId = String(match[1] || '');
  const action = String(match[2] || '') as 'activate' | 'deactivate';
  return { userId, action };
}

function parseUserDeleteRoute(path: string): { userId: string } | null {
  const match = path.match(/^\/(?:api\/)?users\/([0-9a-fA-F-]+)$/);
  if (!match) {
    return null;
  }

  const userId = String(match[1] || '');
  return { userId };
}

async function logAuthAuditEvent({
  requestId,
  event,
  userId,
  actorUserId,
  ipAddress,
  metadata,
}: {
  requestId: string;
  event: AuthAuditEventType;
  userId?: string | null;
  actorUserId?: string | null;
  ipAddress: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const safeMetadata = metadata || {};

  const query = `
    INSERT INTO audit_logs (event_type, user_id, actor_user_id, ip_address, metadata)
    VALUES ($1, $2, $3, $4, $5::jsonb)
  `;

  try {
    await dbPool.query(query, [
      event,
      userId || null,
      actorUserId || null,
      ipAddress,
      JSON.stringify(safeMetadata),
    ]);
  } catch (error) {
    console.warn('[audit] failed to persist auth audit event:', (error as Error).message);
  }

  console.log(
    JSON.stringify({
      level: 'info',
      event,
      service: 'ghs-api',
      requestId,
      userId: userId || null,
      actorUserId: actorUserId || null,
      ipAddress,
      metadata: safeMetadata,
      timestamp: new Date().toISOString(),
    }),
  );
}

function validateRefreshInput(payload: Record<string, unknown>): ValidationResult<{ refreshToken: string }> {
  const errors: ValidationError[] = [];
  const refreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';

  if (!refreshToken) {
    errors.push({ field: 'refreshToken', message: 'refreshToken is required' });
  }

  return {
    errors,
    value: {
      refreshToken,
    },
  };
}

function validateLogoutInput(payload: Record<string, unknown>): ValidationResult<{ refreshToken: string }> {
  const errors: ValidationError[] = [];
  const refreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';

  if (!refreshToken) {
    errors.push({ field: 'refreshToken', message: 'refreshToken is required' });
  }

  return {
    errors,
    value: {
      refreshToken,
    },
  };
}

function getBearerToken(req: http.IncomingMessage): string | null {
  const rawHeader = req.headers.authorization;
  if (typeof rawHeader !== 'string') {
    return null;
  }

  const match = rawHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  return match[1].trim();
}

function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function secondsUntilEpoch(epochSeconds: number): number {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(1, Number(epochSeconds || 0) - nowSeconds);
}

function isLocallyRevoked(digest: string): boolean {
  const expiresAt = localRevokedRefreshTokenDigests.get(digest);
  if (!expiresAt) {
    return false;
  }

  if (Date.now() >= expiresAt) {
    localRevokedRefreshTokenDigests.delete(digest);
    return false;
  }

  return true;
}

function markLocallyRevoked(digest: string, decodedToken: JWTClaims): void {
  const expiresAt = Number(decodedToken.exp || 0) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return;
  }

  localRevokedRefreshTokenDigests.set(digest, expiresAt);
}

async function markRefreshTokenBlacklisted(refreshToken: string, decodedToken: JWTClaims): Promise<void> {
  const digest = hashToken(refreshToken);
  markLocallyRevoked(digest, decodedToken);

  if (!redisReady) {
    return;
  }

  const blacklistedKey = `ghs:auth:refresh:blacklist:${digest}`;
  const ttl = secondsUntilEpoch(decodedToken.exp || 0);
  await redisClient.set(blacklistedKey, '1', { EX: ttl });
}

async function ensureRefreshTokenUsable(refreshToken: string, decodedToken: JWTClaims): Promise<boolean> {
  const digest = hashToken(refreshToken);
  if (isLocallyRevoked(digest)) {
    return false;
  }

  if (!redisReady) {
    markLocallyRevoked(digest, decodedToken);
    return true;
  }

  const rotatedKey = `ghs:auth:refresh:rotated:${digest}`;
  const blacklistedKey = `ghs:auth:refresh:blacklist:${digest}`;
  const [rotated, blacklisted] = await Promise.all([
    redisClient.exists(rotatedKey),
    redisClient.exists(blacklistedKey),
  ]);

  if (rotated || blacklisted) {
    return false;
  }

  const ttl = secondsUntilEpoch(decodedToken.exp || 0);
  await redisClient.set(rotatedKey, '1', { EX: ttl });
  markLocallyRevoked(digest, decodedToken);
  return true;
}

// RBAC Middleware
function verifyAndAuthorize(
  req: http.IncomingMessage,
  options: RequireRoleOptions,
): RBACMiddlewareResult {
  const token = getBearerToken(req);

  if (!token) {
    return {
      success: false,
      statusCode: 401,
      errorCode: 'unauthorized',
      errorMessage: 'Missing or invalid authorization token',
    };
  }

  let claims: JWTClaims;
  try {
    claims = jwt.verify(token, jwtSecret) as JWTClaims;
  } catch {
    return {
      success: false,
      statusCode: 401,
      errorCode: 'unauthorized',
      errorMessage: 'Invalid or expired authorization token',
    };
  }

  if (!claims || claims.tokenType !== 'access' || !claims.sub) {
    return {
      success: false,
      statusCode: 401,
      errorCode: 'unauthorized',
      errorMessage: 'Invalid access token format',
    };
  }

  const userRole = (claims.role || 'player') as UserRole;

  // Validate role is one of the known roles
  const validRoles: UserRole[] = ['admin', 'player', 'viewer'];
  if (!validRoles.includes(userRole)) {
    return {
      success: false,
      statusCode: 403,
      errorCode: 'invalid_role',
      errorMessage: 'User has an invalid role',
    };
  }

  // Check if user role is in required roles
  if (!options.requiredRoles.includes(userRole)) {
    return {
      success: false,
      statusCode: 403,
      errorCode: 'forbidden',
      errorMessage: `User role '${userRole}' is not authorized for this endpoint`,
    };
  }

  return {
    success: true,
    auth: {
      userId: String(claims.sub),
      role: userRole,
      claims,
    },
  };
}

const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
  const startedAt = Date.now();
  const requestId = normalizeRequestId(req.headers['x-request-id'] as string | undefined);
  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    logRequest({
      requestId,
      req,
      statusCode: res.statusCode || 500,
      durationMs: Date.now() - startedAt,
    });
  });

  const method = (req.method || 'GET').toUpperCase();
  const requestUrl = parseUrl(req);
  const pathname = requestUrl.pathname;
  const clientIp = getClientIp(req);

  try {
    if (pathname === '/health' || pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'ghs-api',
        cache: {
          provider: 'redis',
          redisReady,
          redisUrl,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/dashboard') {
      const result = await getOrSetCache({
        resource: 'dashboard',
        requestUrl,
        computeValue: async () => buildDashboardSummary(),
      });

      sendJson(res, 200, {
        ...result.value,
        cache: {
          hit: result.cacheHit,
          key: result.key,
          ttlSeconds: result.ttl,
        },
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/leaderboard') {
      const result = await getOrSetCache({
        resource: 'leaderboard',
        requestUrl,
        computeValue: async () => buildLeaderboardSummary(requestUrl),
      });

      sendJson(res, 200, {
        ...result.value,
        cache: {
          hit: result.cacheHit,
          key: result.key,
          ttlSeconds: result.ttl,
        },
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/settings') {
      const result = await getOrSetCache({
        resource: 'settings',
        requestUrl,
        computeValue: async () => buildSettingsSummary(),
      });

      sendJson(res, 200, {
        ...result.value,
        cache: {
          hit: result.cacheHit,
          key: result.key,
          ttlSeconds: result.ttl,
        },
      });
      return;
    }

    if (method === 'POST' && (pathname === '/auth/register' || pathname === '/api/auth/register')) {
      let payload: Record<string, unknown>;

      try {
        payload = await readJsonBody(req);
      } catch (error) {
        sendError(res, 400, 'invalid_json', (error as Error).message);
        return;
      }

      const validation = validateRegistrationInput(payload);
      if (validation.errors.length > 0) {
        sendError(res, 400, 'validation_error', 'Request validation failed', validation.errors);
        return;
      }

      try {
        const user = await registerUser(validation.value);
        const responseBody: Record<string, unknown> = { user };

        if (authAutoLoginEnabled) {
          responseBody.tokens = buildAuthTokens(user);
        }

        sendJson(res, 201, responseBody);
      } catch (error) {
        const err = error as Record<string, unknown>;
        if (err && err.code === '23505') {
          sendError(res, 409, 'email_already_exists', 'A user with this email already exists');
          return;
        }

        console.error('[auth.register] unexpected error:', error);
        sendError(res, 500, 'registration_failed', 'Unable to register user at this time');
      }
      return;
    }

    if (method === 'POST' && (pathname === '/auth/login' || pathname === '/api/auth/login')) {
      let payload: Record<string, unknown>;

      try {
        payload = await readJsonBody(req);
      } catch (error) {
        sendError(res, 400, 'invalid_json', (error as Error).message);
        return;
      }

      const validation = validateLoginInput(payload);
      if (validation.errors.length > 0) {
        sendError(res, 400, 'validation_error', 'Request validation failed', validation.errors);
        return;
      }

      try {
        const user = await findUserByEmail(validation.value.email);
        const isValidPassword = user
          ? await bcrypt.compare(validation.value.password, user.password_hash || '')
          : false;

        if (!user || !user.is_active || !isValidPassword) {
          await logAuthAuditEvent({
            requestId,
            event: 'auth_login_failure',
            userId: user?.id || null,
            ipAddress: clientIp,
            metadata: {
              reason: 'invalid_credentials',
            },
          });
          sendError(res, 401, 'invalid_credentials', 'Invalid email or password');
          return;
        }

        const responseUser: User = {
          id: user.id,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          created_at: user.created_at,
          updated_at: user.updated_at,
        };

        await logAuthAuditEvent({
          requestId,
          event: 'auth_login_success',
          userId: responseUser.id,
          ipAddress: clientIp,
          metadata: {
            role: responseUser.role,
          },
        });

        sendJson(res, 200, {
          user: responseUser,
          tokens: buildAuthTokens(responseUser),
        });
      } catch (error) {
        console.error('[auth.login] unexpected error:', error);
        sendError(res, 500, 'login_failed', 'Unable to login at this time');
      }
      return;
    }

    if (method === 'POST' && (pathname === '/auth/refresh' || pathname === '/api/auth/refresh')) {
      let payload: Record<string, unknown>;

      try {
        payload = await readJsonBody(req);
      } catch (error) {
        sendError(res, 400, 'invalid_json', (error as Error).message);
        return;
      }

      const validation = validateRefreshInput(payload);
      if (validation.errors.length > 0) {
        sendError(res, 400, 'validation_error', 'Request validation failed', validation.errors);
        return;
      }

      let decodedToken: JWTClaims & { exp?: number };
      try {
        decodedToken = jwt.verify(validation.value.refreshToken, jwtSecret) as JWTClaims & { exp?: number };
      } catch {
        await logAuthAuditEvent({
          requestId,
          event: 'auth_refresh',
          ipAddress: clientIp,
          metadata: {
            success: false,
            reason: 'invalid_or_expired_refresh_token',
          },
        });
        sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
        return;
      }

      if (!decodedToken || decodedToken.tokenType !== 'refresh' || !decodedToken.sub) {
        await logAuthAuditEvent({
          requestId,
          event: 'auth_refresh',
          ipAddress: clientIp,
          metadata: {
            success: false,
            reason: 'invalid_refresh_token_claims',
          },
        });
        sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
        return;
      }

      try {
        const isUsable = await ensureRefreshTokenUsable(validation.value.refreshToken, decodedToken);
        if (!isUsable) {
          await logAuthAuditEvent({
            requestId,
            event: 'auth_refresh',
            userId: decodedToken.sub,
            ipAddress: clientIp,
            metadata: {
              success: false,
              reason: 'refresh_token_not_usable',
            },
          });
          sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
          return;
        }

        const user = await findUserById(decodedToken.sub);
        if (!user || !user.is_active) {
          await logAuthAuditEvent({
            requestId,
            event: 'auth_refresh',
            userId: decodedToken.sub,
            ipAddress: clientIp,
            metadata: {
              success: false,
              reason: 'user_not_found_or_inactive',
            },
          });
          sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
          return;
        }

        await logAuthAuditEvent({
          requestId,
          event: 'auth_refresh',
          userId: user.id,
          ipAddress: clientIp,
          metadata: {
            success: true,
            role: user.role,
          },
        });

        sendJson(res, 200, {
          user,
          tokens: buildAuthTokens(user),
        });
      } catch (error) {
        console.error('[auth.refresh] unexpected error:', error);
        sendError(res, 500, 'refresh_failed', 'Unable to refresh token at this time');
      }
      return;
    }

    if (method === 'POST' && (pathname === '/auth/logout' || pathname === '/api/auth/logout')) {
      let payload: Record<string, unknown>;

      try {
        payload = await readJsonBody(req);
      } catch (error) {
        sendError(res, 400, 'invalid_json', (error as Error).message);
        return;
      }

      const validation = validateLogoutInput(payload);
      if (validation.errors.length > 0) {
        sendError(res, 400, 'validation_error', 'Request validation failed', validation.errors);
        return;
      }

      const accessToken = getBearerToken(req);
      if (!accessToken) {
        sendError(res, 401, 'unauthorized', 'Missing or invalid access token');
        return;
      }

      let accessClaims: JWTClaims;
      try {
        accessClaims = jwt.verify(accessToken, jwtSecret) as JWTClaims;
      } catch {
        sendError(res, 401, 'unauthorized', 'Missing or invalid access token');
        return;
      }

      if (!accessClaims || accessClaims.tokenType !== 'access' || !accessClaims.sub) {
        sendError(res, 401, 'unauthorized', 'Missing or invalid access token');
        return;
      }

      let refreshClaims: JWTClaims & { exp?: number };
      try {
        refreshClaims = jwt.verify(validation.value.refreshToken, jwtSecret) as JWTClaims & { exp?: number };
      } catch {
        sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
        return;
      }

      if (!refreshClaims || refreshClaims.tokenType !== 'refresh' || !refreshClaims.sub) {
        sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
        return;
      }

      if (String(refreshClaims.sub) !== String(accessClaims.sub)) {
        sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
        return;
      }

      try {
        await markRefreshTokenBlacklisted(validation.value.refreshToken, refreshClaims);

        await logAuthAuditEvent({
          requestId,
          event: 'auth_logout',
          userId: String(accessClaims.sub),
          ipAddress: clientIp,
          metadata: {
            success: true,
          },
        });

        sendJson(res, 200, {
          success: true,
          loggedOutAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('[auth.logout] unexpected error:', error);
        sendError(res, 500, 'logout_failed', 'Unable to logout at this time');
      }
      return;
    }

    const userActivationRoute = parseUserActivationRoute(pathname);
    if (method === 'PATCH' && userActivationRoute) {
      const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });

      if (!authResult.success || !authResult.auth) {
        sendError(
          res,
          authResult.statusCode || 401,
          authResult.errorCode || 'unauthorized',
          authResult.errorMessage || 'Unauthorized',
        );
        return;
      }

      const { userId, action } = userActivationRoute;
      if (!isUuid(userId)) {
        sendError(res, 400, 'validation_error', 'User id must be a valid UUID');
        return;
      }

      const nextStatus = action === 'activate';

      try {
        const updatedUser = await setUserActivationStatus(userId, nextStatus);
        if (!updatedUser) {
          sendError(res, 404, 'not_found', 'User not found');
          return;
        }

        await logAuthAuditEvent({
          requestId,
          event: nextStatus ? 'auth_user_activated' : 'auth_user_deactivated',
          userId,
          actorUserId: authResult.auth.userId,
          ipAddress: clientIp,
          metadata: {
            is_active: updatedUser.is_active,
            role: updatedUser.role,
          },
        });

        sendJson(res, 200, {
          user: updatedUser,
          message: nextStatus ? 'User activated successfully' : 'User deactivated successfully',
        });
      } catch (error) {
        console.error('[users.activation] unexpected error:', error);
        sendError(res, 500, 'activation_update_failed', 'Unable to update user activation status');
      }
      return;
    }

    const userDeleteRoute = parseUserDeleteRoute(pathname);
    if (method === 'DELETE' && userDeleteRoute) {
      const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });

      if (!authResult.success || !authResult.auth) {
        sendError(
          res,
          authResult.statusCode || 401,
          authResult.errorCode || 'unauthorized',
          authResult.errorMessage || 'Unauthorized',
        );
        return;
      }

      const { userId } = userDeleteRoute;
      if (!isUuid(userId)) {
        sendError(res, 400, 'validation_error', 'User id must be a valid UUID');
        return;
      }

      try {
        const deletedUser = await softDeleteUserById(userId);
        if (!deletedUser) {
          sendError(res, 404, 'not_found', 'User not found');
          return;
        }

        await logAuthAuditEvent({
          requestId,
          event: 'auth_user_deleted',
          userId,
          actorUserId: authResult.auth.userId,
          ipAddress: clientIp,
          metadata: {
            softDeleted: true,
            role: deletedUser.role,
          },
        });

        sendJson(res, 200, {
          user: deletedUser,
          message: 'User soft-deleted successfully',
        });
      } catch (error) {
        console.error('[users.delete] unexpected error:', error);
        sendError(res, 500, 'user_delete_failed', 'Unable to soft-delete user');
      }
      return;
    }

    // RBAC Protected Endpoints

    if (method === 'GET' && (pathname === '/api/profile' || pathname === '/profile')) {
      const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player', 'viewer'] });

      if (!authResult.success || !authResult.auth) {
        sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
        return;
      }

      sendJson(res, 200, {
        user: {
          id: authResult.auth.userId,
          role: authResult.auth.role,
        },
        message: 'User profile retrieved successfully',
      });
      return;
    }

    if (method === 'GET' && (pathname === '/api/admin/status' || pathname === '/admin/status')) {
      const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });

      if (!authResult.success || !authResult.auth) {
        sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
        return;
      }

      sendJson(res, 200, {
        admin: true,
        userId: authResult.auth.userId,
        systemStatus: {
          redisReady,
          dbPoolReady: !dbPool.ended,
          startupTime: new Date().toISOString(),
        },
        message: 'Admin status retrieved successfully',
      });
      return;
    }

    if (method === 'GET' && (pathname === '/api/admin/users' || pathname === '/admin/users')) {
      const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });

      if (!authResult.success || !authResult.auth) {
        sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
        return;
      }

      try {
        const includeDeleted = requestUrl.searchParams.get('includeDeleted') === 'true';
        const query = includeDeleted
          ? 'SELECT id, email, role, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 10'
          : 'SELECT id, email, role, is_active, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 10';
        const result = await dbPool.query(query);
        sendJson(res, 200, {
          users: result.rows,
          total: result.rowCount,
          includeDeleted,
          message: 'Users list retrieved successfully',
        });
      } catch (error) {
        console.error('[admin.users] error:', error);
        sendError(res, 500, 'database_error', 'Unable to retrieve users list');
      }
      return;
    }

    // ── POST /auth/password-reset/request ──────────────────────────────
    if (method === 'POST' && (pathname === '/auth/password-reset/request' || pathname === '/api/auth/password-reset/request')) {
      const body = await readJsonBody(req);
      const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
      // Always return same response to prevent user enumeration
      const safeResponse = { message: 'If that email is registered you will receive a reset link shortly.' };
      if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
        sendJson(res, 200, safeResponse);
        return;
      }
      try {
        const userResult = await dbPool.query(
          'SELECT id, email::text AS email FROM users WHERE email = $1 AND deleted_at IS NULL AND is_active = TRUE',
          [rawEmail]
        );
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          // Invalidate any existing unused tokens for this user
          await dbPool.query(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
            [user.id]
          );
          // Generate a secure random token (32 bytes = 64 hex chars)
          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          const expiresAt = new Date(Date.now() + passwordResetTokenExpiryMinutes * 60 * 1000);
          await dbPool.query(
            'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [user.id, tokenHash, expiresAt]
          );
          // Send email
          const resetUrl = `${process.env.APP_URL || 'http://localhost:5175'}/reset-password?token=${rawToken}`;
          const transport = createMailTransport();
          await transport.sendMail({
            from: `"${smtpFromName}" <${smtpFromEmail}>`,
            to: user.email,
            subject: 'Reset your password',
            text: `You requested a password reset. Use this link (valid for ${passwordResetTokenExpiryMinutes} minutes):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
            html: `<p>You requested a password reset. Click the link below (valid for ${passwordResetTokenExpiryMinutes} minutes):</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, ignore this email.</p>`,
          });
          await logAuthAuditEvent({
            requestId,
            event: 'auth_password_reset_requested',
            userId: user.id,
            ipAddress: clientIp,
            metadata: {},
          });
        }
      } catch (error) {
        console.error('[password-reset.request] error:', error);
        // Still return safe response
      }
      sendJson(res, 200, safeResponse);
      return;
    }

    // ── POST /auth/password-reset/confirm ──────────────────────────────
    if (method === 'POST' && (pathname === '/auth/password-reset/confirm' || pathname === '/api/auth/password-reset/confirm')) {
      const body = await readJsonBody(req);
      const rawToken = typeof body.token === 'string' ? body.token.trim() : '';
      const newPassword = typeof body.password === 'string' ? body.password : '';
      if (!rawToken || !newPassword) {
        sendError(res, 400, 'validation_error', 'token and password are required');
        return;
      }
      if (newPassword.length < 8) {
        sendError(res, 400, 'validation_error', 'password must be at least 8 characters');
        return;
      }
      try {
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenResult = await dbPool.query(
          `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
           FROM password_reset_tokens prt
           JOIN users u ON u.id = prt.user_id
           WHERE prt.token_hash = $1 AND u.deleted_at IS NULL AND u.is_active = TRUE`,
          [tokenHash]
        );
        if (tokenResult.rows.length === 0) {
          sendError(res, 400, 'invalid_token', 'Token is invalid or has expired');
          return;
        }
        const tokenRow = tokenResult.rows[0];
        if (tokenRow.used_at !== null) {
          sendError(res, 400, 'invalid_token', 'Token has already been used');
          return;
        }
        if (new Date(tokenRow.expires_at) < new Date()) {
          sendError(res, 400, 'invalid_token', 'Token has expired');
          return;
        }
        const newHash = await bcrypt.hash(newPassword, 12);
        await dbPool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, tokenRow.user_id]);
        await dbPool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenRow.id]);
        await logAuthAuditEvent({
          requestId,
          event: 'auth_password_reset_completed',
          userId: tokenRow.user_id,
          ipAddress: clientIp,
          metadata: {},
        });
        sendJson(res, 200, { message: 'Password reset successfully' });
      } catch (error) {
        console.error('[password-reset.confirm] error:', error);
        sendError(res, 500, 'internal_error', 'Unable to reset password');
      }
      return;
    }

    if (method === 'POST' && pathname === '/api/cache/invalidate') {
      if (cacheAdminKey && req.headers['x-cache-admin-key'] !== cacheAdminKey) {
        sendJson(res, 403, {
          error: 'forbidden',
          message: 'Invalid cache admin key',
        });
        return;
      }

      const target = requestUrl.searchParams.get('target') || 'all';
      if (!['all', 'dashboard', 'leaderboard', 'settings'].includes(target)) {
        sendJson(res, 400, {
          error: 'invalid_target',
          message: 'target must be one of: all, dashboard, leaderboard, settings',
        });
        return;
      }

      const result = await invalidateCache(target as 'all' | 'dashboard' | 'leaderboard' | 'settings');
      sendJson(res, 200, {
        ...result,
        target,
        invalidatedAt: new Date().toISOString(),
      });
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(res, 200, { message: 'API bootstrap route', path: pathname });
      return;
    }

    sendJson(res, 200, {
      message: 'ghs-api running',
      health: '/health',
      apiHealth: '/api/health',
      cacheEndpoints: ['/api/dashboard', '/api/leaderboard', '/api/settings'],
    });
  } catch (error) {
    sendJson(res, 500, {
      error: 'internal_error',
      message: (error as Error).message,
    });
  }
});

server.listen(port, () => {
  console.log(`ghs-api listening on http://localhost:${port}`);
});
