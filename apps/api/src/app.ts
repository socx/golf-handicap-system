import http from 'node:http';
import { env } from './config/env';
import { redisState } from './lib/redis';
import { sendJson, normalizeRequestId, logRequest, parseUrl } from './lib/http';
import { getOrSetCache, invalidateCache, buildDashboardSummary, buildLeaderboardSummary, buildSettingsSummary } from './lib/cache';
import { verifyAndAuthorize } from './middleware/auth';
import { handleRegister } from './routes/auth/register';
import { handleLogin } from './routes/auth/login';
import { handleRefresh } from './routes/auth/refresh';
import { handleLogout } from './routes/auth/logout';
import { handlePasswordResetRequest, handlePasswordResetConfirm } from './routes/auth/passwordReset';
import { handleMe } from './routes/auth/me';
import { handleActivateAccount } from './routes/auth/activate';
import { handleReportClientError } from './routes/clientErrors';
import { handleListUsers, handleAdminStatus, handleUserActivation, handleUserDelete } from './routes/admin/users';
import { handleCreatePlayer, handleDeletePlayer, handleExportPlayers, handleGetPlayer, handleLinkPlayerUser, handleListPlayers, handleUpdatePlayer } from './routes/players';
import { handleCreateCourse, handleListCourses, handleGetCourse, handleUpdateCourse, handleDeleteCourse, handleCreateTeeConfiguration, handleUpdateTeeConfiguration } from './routes/courses';
import { handleCreateRound, handleGetRound, handleListRounds } from './routes/rounds';

function parseUserActivationRoute(path: string): { userId: string; action: 'activate' | 'deactivate' } | null {
  const match = path.match(/^\/(?:api\/)?users\/([0-9a-fA-F-]+)\/(activate|deactivate)$/);
  if (!match) return null;
  return { userId: String(match[1] || ''), action: String(match[2] || '') as 'activate' | 'deactivate' };
}

function parseUserDeleteRoute(path: string): { userId: string } | null {
  const match = path.match(/^\/(?:api\/)?users\/([0-9a-fA-F-]+)$/);
  if (!match) return null;
  return { userId: String(match[1] || '') };
}

function parsePlayerRoute(path: string): { playerId: string; action: 'update' | 'link-user' | 'delete' } | null {
  const updateOrDeleteMatch = path.match(/^\/(?:api\/)?players\/([0-9a-fA-F-]+)$/);
  if (updateOrDeleteMatch) {
    return { playerId: String(updateOrDeleteMatch[1] || ''), action: 'update' };
  }

  const linkMatch = path.match(/^\/(?:api\/)?players\/([0-9a-fA-F-]+)\/link-user$/);
  if (linkMatch) {
    return { playerId: String(linkMatch[1] || ''), action: 'link-user' };
  }

  return null;
}

function parseCourseRoute(path: string): { courseId: string; action?: string } | null {
  const deleteIdsMatch = path.match(/^\/(?:api\/)?courses\/([0-9a-fA-F-]+)$/);
  if (deleteIdsMatch) {
    return { courseId: String(deleteIdsMatch[1] || '') };
  }
  return null;
}

function parseTeeConfigurationRoute(path: string): { configId: string; action?: 'holes' } | null {
  const updateMatch = path.match(/^\/(?:api\/)?configurations\/([0-9a-fA-F-]+)$/);
  if (updateMatch) {
    return { configId: String(updateMatch[1] || '') };
  }

  const holesMatch = path.match(/^\/(?:api\/)?configurations\/([0-9a-fA-F-]+)\/holes$/);
  if (holesMatch) {
    return { configId: String(holesMatch[1] || ''), action: 'holes' };
  }

  return null;
}

function parseCourseConfigRoute(path: string): { courseId: string; isConfig?: boolean } | null {
  const match = path.match(/^\/(?:api\/)?courses\/([0-9a-fA-F-]+)\/configurations$/);
  if (match) {
    return { courseId: String(match[1] || ''), isConfig: true };
  }
  return null;
}

function parseRoundRoute(path: string): { roundId: string } | null {
  const match = path.match(/^\/(?:api\/)?rounds\/([0-9a-fA-F-]+)$/);
  if (!match) return null;
  return { roundId: String(match[1] || '') };
}

const server = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
  const startedAt = Date.now();
  const requestId = normalizeRequestId(req.headers['x-request-id'] as string | undefined);
  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    logRequest({ requestId, req, statusCode: res.statusCode || 500, durationMs: Date.now() - startedAt });
  });

  const method = (req.method || 'GET').toUpperCase();
  const requestUrl = parseUrl(req);
  const pathname = requestUrl.pathname;

  try {
    // ── Health ──────────────────────────────────────────────────────────
    if (pathname === '/health' || pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'ghs-api',
        cache: { provider: 'redis', redisReady: redisState.ready, redisUrl: env.redisUrl },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // ── Cache-backed dashboard / leaderboard / settings ─────────────────
    if (method === 'GET' && pathname === '/api/dashboard') {
      const result = await getOrSetCache({ resource: 'dashboard', requestUrl, computeValue: async () => buildDashboardSummary() });
      sendJson(res, 200, { ...result.value, cache: { hit: result.cacheHit, key: result.key, ttlSeconds: result.ttl } });
      return;
    }

    if (method === 'GET' && pathname === '/api/leaderboard') {
      const result = await getOrSetCache({ resource: 'leaderboard', requestUrl, computeValue: async () => buildLeaderboardSummary(requestUrl) });
      sendJson(res, 200, { ...result.value, cache: { hit: result.cacheHit, key: result.key, ttlSeconds: result.ttl } });
      return;
    }

    if (method === 'GET' && pathname === '/api/settings') {
      const result = await getOrSetCache({ resource: 'settings', requestUrl, computeValue: async () => buildSettingsSummary() });
      sendJson(res, 200, { ...result.value, cache: { hit: result.cacheHit, key: result.key, ttlSeconds: result.ttl } });
      return;
    }

    // ── Auth ─────────────────────────────────────────────────────────────
    if (method === 'POST' && (pathname === '/auth/register' || pathname === '/api/auth/register')) {
      await handleRegister(req, res);
      return;
    }

    if (method === 'POST' && (pathname === '/auth/login' || pathname === '/api/auth/login')) {
      await handleLogin(req, res, requestId);
      return;
    }

    if (method === 'POST' && (pathname === '/auth/refresh' || pathname === '/api/auth/refresh')) {
      await handleRefresh(req, res, requestId);
      return;
    }

    if (method === 'POST' && (pathname === '/auth/logout' || pathname === '/api/auth/logout')) {
      await handleLogout(req, res, requestId);
      return;
    }

    if (method === 'GET' && (pathname === '/auth/activate' || pathname === '/api/auth/activate')) {
      await handleActivateAccount(req, res, requestUrl.searchParams.get('token') || '');
      return;
    }

    if (method === 'POST' && (pathname === '/auth/activate' || pathname === '/api/auth/activate')) {
      await handleActivateAccount(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/auth/me' || pathname === '/api/auth/me')) {
      await handleMe(req, res);
      return;
    }

    if (method === 'POST' && (pathname === '/auth/password-reset/request' || pathname === '/api/auth/password-reset/request')) {
      await handlePasswordResetRequest(req, res, requestId);
      return;
    }

    if (method === 'POST' && (pathname === '/auth/password-reset/confirm' || pathname === '/api/auth/password-reset/confirm')) {
      await handlePasswordResetConfirm(req, res, requestId);
      return;
    }

    if (method === 'POST' && (pathname === '/client-errors' || pathname === '/api/client-errors')) {
      await handleReportClientError(req, res, requestId);
      return;
    }

    // ── Admin ─────────────────────────────────────────────────────────────
    if (method === 'GET' && (pathname === '/api/admin/status' || pathname === '/admin/status')) {
      await handleAdminStatus(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/api/admin/users' || pathname === '/admin/users')) {
      await handleListUsers(req, res, requestUrl);
      return;
    }

    // ── Players ───────────────────────────────────────────────────────────
    if (method === 'POST' && (pathname === '/api/players' || pathname === '/players')) {
      await handleCreatePlayer(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/api/players' || pathname === '/players')) {
      await handleListPlayers(req, res, requestUrl);
      return;
    }

    if (method === 'GET' && (pathname === '/api/players/export' || pathname === '/players/export')) {
      await handleExportPlayers(req, res, requestUrl);
      return;
    }

    const playerRoute = parsePlayerRoute(pathname);
    if (playerRoute && method === 'GET' && playerRoute.action === 'update') {
      await handleGetPlayer(req, res, playerRoute.playerId);
      return;
    }

    if (playerRoute && method === 'PATCH' && playerRoute.action === 'update') {
      await handleUpdatePlayer(req, res, playerRoute.playerId);
      return;
    }

    if (playerRoute && method === 'PATCH' && playerRoute.action === 'link-user') {
      await handleLinkPlayerUser(req, res, requestId, playerRoute.playerId);
      return;
    }

    if (playerRoute && method === 'DELETE' && playerRoute.action === 'update') {
      await handleDeletePlayer(req, res, requestId, playerRoute.playerId);
      return;
    }

    // ── Courses ───────────────────────────────────────────────────────────
    if (method === 'POST' && (pathname === '/api/courses' || pathname === '/courses')) {
      await handleCreateCourse(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/api/courses' || pathname === '/courses')) {
      await handleListCourses(req, res, requestUrl);
      return;
    }

    const courseRoute = parseCourseRoute(pathname);
    if (courseRoute && method === 'GET') {
      await handleGetCourse(req, res, courseRoute.courseId);
      return;
    }

    if (courseRoute && method === 'PATCH') {
      await handleUpdateCourse(req, res, courseRoute.courseId);
      return;
    }

    if (courseRoute && method === 'DELETE') {
      await handleDeleteCourse(req, res, courseRoute.courseId);
      return;
    }

    // ── Tee Configurations ────────────────────────────────────────────────
    const courseConfigRoute = parseCourseConfigRoute(pathname);
    if (courseConfigRoute && method === 'POST') {
      await handleCreateTeeConfiguration(req, res, courseConfigRoute.courseId);
      return;
    }

    const teeConfigRoute = parseTeeConfigurationRoute(pathname);
    if (teeConfigRoute && method === 'PATCH') {
      await handleUpdateTeeConfiguration(req, res, teeConfigRoute.configId);
      return;
    }

    // ── Rounds ────────────────────────────────────────────────────────────
    if (method === 'POST' && (pathname === '/api/rounds' || pathname === '/rounds')) {
      await handleCreateRound(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/api/rounds' || pathname === '/rounds')) {
      await handleListRounds(req, res, requestUrl);
      return;
    }

    const roundRoute = parseRoundRoute(pathname);
    if (roundRoute && method === 'GET') {
      await handleGetRound(req, res, roundRoute.roundId);
      return;
    }

    const userActivationRoute = parseUserActivationRoute(pathname);
    if (method === 'PATCH' && userActivationRoute) {
      await handleUserActivation(req, res, requestId, userActivationRoute.userId, userActivationRoute.action);
      return;
    }

    const userDeleteRoute = parseUserDeleteRoute(pathname);
    if (method === 'DELETE' && userDeleteRoute) {
      await handleUserDelete(req, res, requestId, userDeleteRoute.userId);
      return;
    }

    // ── RBAC demo profile ────────────────────────────────────────────────
    if (method === 'GET' && (pathname === '/api/profile' || pathname === '/profile')) {
      const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player', 'viewer'] });
      if (!authResult.success || !authResult.auth) {
        sendJson(res, authResult.statusCode || 401, { error: { code: authResult.errorCode, message: authResult.errorMessage } });
        return;
      }
      sendJson(res, 200, { user: { id: authResult.auth.userId, role: authResult.auth.role }, message: 'User profile retrieved successfully' });
      return;
    }

    // ── Cache invalidation ────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/api/cache/invalidate') {
      if (env.cacheAdminKey && req.headers['x-cache-admin-key'] !== env.cacheAdminKey) {
        sendJson(res, 403, { error: 'forbidden', message: 'Invalid cache admin key' });
        return;
      }
      const target = requestUrl.searchParams.get('target') || 'all';
      if (!['all', 'dashboard', 'leaderboard', 'settings'].includes(target)) {
        sendJson(res, 400, { error: 'invalid_target', message: 'target must be one of: all, dashboard, leaderboard, settings' });
        return;
      }
      const result = await invalidateCache(target as 'all' | 'dashboard' | 'leaderboard' | 'settings');
      sendJson(res, 200, { ...result, target, invalidatedAt: new Date().toISOString() });
      return;
    }

    if (pathname.startsWith('/api/')) {
      sendJson(res, 200, { message: 'API bootstrap route', path: pathname });
      return;
    }

    sendJson(res, 200, { message: 'ghs-api running', health: '/health', apiHealth: '/api/health' });
  } catch (error) {
    console.error('[app] unhandled request error:', error);
    sendJson(res, 500, { error: 'internal_error', message: (error as Error).message });
  }
});

server.listen(env.port, () => {
  console.log(`ghs-api listening on http://localhost:${env.port}`);
});
