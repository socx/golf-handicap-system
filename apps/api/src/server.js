const http = require('node:http');
const crypto = require('node:crypto');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const { createClient } = require('redis');
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

const ttlByResource = {
  dashboard: Number(process.env.CACHE_TTL_DASHBOARD_SECONDS || 60),
  leaderboard: Number(process.env.CACHE_TTL_LEADERBOARD_SECONDS || 45),
  settings: Number(process.env.CACHE_TTL_SETTINGS_SECONDS || 300),
};

const cacheKeysByResource = {
  dashboard: new Set(),
  leaderboard: new Set(),
  settings: new Set(),
};

const redisClient = createClient({ url: redisUrl });
const dbPool = new Pool({ connectionString: dbUrl });

let redisReady = false;

redisClient.on('ready', () => {
  redisReady = true;
  console.log('[cache] redis connected');
});

redisClient.on('error', (error) => {
  redisReady = false;
  console.error('[cache] redis error:', error.message);
});

redisClient.connect().catch((error) => {
  redisReady = false;
  console.warn('[cache] running without redis:', error.message);
});

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendError(res, statusCode, code, message, details) {
  const errorBody = {
    error: {
      code,
      message,
    },
  };

  if (details) {
    errorBody.error.details = details;
  }

  sendJson(res, statusCode, errorBody);
}

function normalizeRequestId(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return crypto.randomUUID();
  }
  return value.trim().slice(0, 128);
}

function logRequest({ requestId, req, statusCode, durationMs }) {
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

function parseUrl(req) {
  const host = req.headers.host || `localhost:${port}`;
  return new URL(req.url || '/', `http://${host}`);
}

function buildCacheKey(resource, requestUrl) {
  const params = [...requestUrl.searchParams.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const digest = crypto.createHash('sha1').update(params).digest('hex').slice(0, 12);
  return `ghs:cache:${resource}:${digest}`;
}

async function getOrSetCache({ resource, requestUrl, computeValue }) {
  const ttl = Math.max(1, Number(ttlByResource[resource] || 60));
  const key = buildCacheKey(resource, requestUrl);

  if (redisReady) {
    const cached = await redisClient.get(key);
    if (cached) {
      return {
        cacheHit: true,
        key,
        ttl,
        value: JSON.parse(cached),
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

async function invalidateCache(resource) {
  if (!redisReady) {
    return { invalidated: 0, redisReady: false };
  }

  const targets = resource === 'all'
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

function buildDashboardSummary() {
  return {
    activePlayers: 42,
    roundsToday: 18,
    averageHandicap: 14.7,
    generatedAt: new Date().toISOString(),
  };
}

function buildLeaderboardSummary(url) {
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

function buildSettingsSummary() {
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

function readJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', (chunk) => {
      body += chunk;
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
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', (error) => reject(error));
  });
}

function validateRegistrationInput(payload) {
  const errors = [];
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

function buildAuthTokens(user) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, tokenType: 'access' },
    jwtSecret,
    { expiresIn: jwtAccessExpiresIn },
  );

  const refreshToken = jwt.sign(
    { sub: user.id, role: user.role, tokenType: 'refresh' },
    jwtSecret,
    { expiresIn: jwtRefreshExpiresIn },
  );

  return {
    accessToken,
    refreshToken,
    expiresIn: jwtAccessExpiresIn,
  };
}

async function registerUser(payload) {
  const passwordHash = await bcrypt.hash(payload.password, 12);
  const query = `
    INSERT INTO users (email, password_hash, role, is_active)
    VALUES ($1, $2, $3, TRUE)
    RETURNING id, email::text AS email, role, is_active, created_at, updated_at
  `;

  const result = await dbPool.query(query, [payload.email, passwordHash, payload.role]);
  return result.rows[0];
}

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  const requestId = normalizeRequestId(req.headers['x-request-id']);
  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    logRequest({
      requestId,
      req,
      statusCode: res.statusCode,
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
      let payload;

      try {
        payload = await readJsonBody(req);
      } catch (error) {
        sendError(res, 400, 'invalid_json', error.message);
        return;
      }

      const validation = validateRegistrationInput(payload);
      if (validation.errors.length > 0) {
        sendError(
          res,
          400,
          'validation_error',
          'Request validation failed',
          validation.errors,
        );
        return;
      }

      try {
        const user = await registerUser(validation.value);
        const responseBody = { user };

        if (authAutoLoginEnabled) {
          responseBody.tokens = buildAuthTokens(user);
        }

        sendJson(res, 201, responseBody);
      } catch (error) {
        if (error && error.code === '23505') {
          sendError(res, 409, 'email_already_exists', 'A user with this email already exists');
          return;
        }

        console.error('[auth.register] unexpected error:', error);
        sendError(res, 500, 'registration_failed', 'Unable to register user at this time');
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

      const result = await invalidateCache(target);
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
      message: error.message,
    });
  }
});

server.listen(port, () => {
  console.log(`ghs-api listening on http://localhost:${port}`);
});
