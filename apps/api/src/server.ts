import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { createClient } from 'redis';
import type { AuthTokens, JWTClaims, User, ValidationError, ValidationResult } from '@ghs/types';

// eslint-disable-next-line @typescript-eslint/no-require-imports
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
      } catch (error) {
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
      } catch (error) {
        sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
        return;
      }

      if (!decodedToken || decodedToken.tokenType !== 'refresh' || !decodedToken.sub) {
        sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
        return;
      }

      try {
        const isUsable = await ensureRefreshTokenUsable(validation.value.refreshToken, decodedToken);
        if (!isUsable) {
          sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
          return;
        }

        const user = await findUserById(decodedToken.sub);
        if (!user || !user.is_active) {
          sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
          return;
        }

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
      } catch (error) {
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
      } catch (error) {
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

        console.log(
          JSON.stringify({
            level: 'info',
            event: 'auth_logout',
            service: 'ghs-api',
            requestId,
            userId: accessClaims.sub,
            timestamp: new Date().toISOString(),
          }),
        );

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
