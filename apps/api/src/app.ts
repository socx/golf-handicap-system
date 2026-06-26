import http from 'node:http';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { env } from './config/env';
import { redisState } from './lib/redis';
import { sendJson, normalizeRequestId, logRequest, parseUrl } from './lib/http';
import { getOrSetCache, invalidateCache, buildLeaderboardSummary, buildSettingsSummary } from './lib/cache';
import { verifyAndAuthorize } from './middleware/auth';
import { errorHandler } from './middlewares/error-handler';
import { handleRegister } from './routes/auth/register';
import { handleLogin } from './routes/auth/login';
import { handleRefresh } from './routes/auth/refresh';
import { handleLogout } from './routes/auth/logout';
import { handlePasswordResetRequest, handlePasswordResetConfirm } from './routes/auth/passwordReset';
import { handleMe } from './routes/auth/me';
import {
  handleGetNotificationPreferences,
  handleUpdateNotificationPreferences,
  handleUpdateProfile,
  handleChangePassword,
} from './routes/auth/settings';
import { handleActivateAccount } from './routes/auth/activate';
import { handleReportClientError } from './routes/clientErrors';
import { handleListAuditLogs } from './routes/admin/auditLogs';
import { handleListPendingRounds } from './routes/admin/rounds';
import { handleGetAdminSettings, handleUpdateAdminSettings } from './routes/admin/settings';
import { handleListUsers, handleAdminStatus, handleUserActivation, handleUserDelete, handleUpdateUserRole } from './routes/admin/users';
import { handleUpsertDailyPcc } from './routes/admin/pcc';
import { handleGetAdminDashboard } from './routes/admin/dashboard';
import { handleRecalculateAllHandicaps, handleGetBatchJobStatus, handleListBatchJobs } from './routes/admin/batch';
import { handleStartImpersonation, handleStopImpersonation } from './routes/admin/impersonation';
import { handleCreatePlayer, handleDeletePlayer, handleExportPlayers, handleGetPlayer, handleImportPlayers, handleLinkPlayerUser, handleListPlayers, handleUpdatePlayer } from './routes/players';
import { handleCreateCourse, handleListCourses, handleGetCourse, handleUpdateCourse, handleDeleteCourse, handleCreateTeeConfiguration, handleUpdateTeeConfiguration, handleDeleteTeeConfiguration } from './routes/courses';
import { handleCreateRound, handleDeleteRound, handleGetRound, handleListRounds, handleApproveRound, handleRejectRound, handleUpdateRound, handleImportRounds } from './routes/rounds';
import { handleCalculateHandicap, handleGetHandicapEligibility, handleGetHandicapHistory, handleCreateHandicapOverride, handleListHandicapOverrides } from './routes/handicap';
import { handleGetDashboardSummary } from './routes/dashboard';
import { handleGetMaintenanceStatus } from './routes/maintenance';
import { handleGetReleaseNotes, handleUpdateReleaseNotes } from './routes/releaseNotes';
import { handleGlobalSearch } from './routes/search';
import { handleCreateFeedback, handleListFeedback } from './routes/feedback';

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

function parseUserRoleRoute(path: string): { userId: string } | null {
  const match = path.match(/^\/(?:api\/)?admin\/users\/([0-9a-fA-F-]+)\/role$/);
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

function parseRoundModerationRoute(path: string): { roundId: string; action: 'approve' | 'reject' } | null {
  const match = path.match(/^\/(?:api\/)?(?:admin\/)?rounds\/([0-9a-fA-F-]+)\/(approve|reject)$/);
  if (!match) return null;
  return { roundId: String(match[1] || ''), action: String(match[2] || '') as 'approve' | 'reject' };
}

function parseAdminTeeConfigurationPccRoute(path: string): { configId: string } | null {
  const match = path.match(/^\/(?:api\/)?admin\/tee-configurations\/([0-9a-fA-F-]+)\/pcc$/);
  if (!match) return null;
  return { configId: String(match[1] || '') };
}

function parseHandicapHistoryRoute(path: string): { playerId: string } | null {
  const match = path.match(/^\/(?:api\/)?handicap\/history\/([0-9a-fA-F-]+)$/);
  if (!match) return null;
  return { playerId: String(match[1] || '') };
}

function parseHandicapOverrideRoute(path: string): { playerId: string } | null {
  const match = path.match(/^\/(?:api\/)?(?:admin\/handicap-override|handicap\/override)\/([0-9a-fA-F-]+)$/);
  if (!match) return null;
  return { playerId: String(match[1] || '') };
}

function parseHandicapCalculateRoute(path: string): { playerId: string } | null {
  const match = path.match(/^\/(?:api\/)?handicap\/calculate\/([0-9a-fA-F-]+)$/);
  if (!match) return null;
  return { playerId: String(match[1] || '') };
}

function parseHandicapEligibilityRoute(path: string): { playerId: string } | null {
  const match = path.match(/^\/(?:api\/)?handicap\/eligibility\/([0-9a-fA-F-]+)$/);
  if (!match) return null;
  return { playerId: String(match[1] || '') };
}

export async function dispatchRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const startedAt = Date.now();
  const requestId = normalizeRequestId(req.headers['x-request-id'] as string | undefined);
  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    logRequest({ requestId, req, statusCode: res.statusCode || 500, durationMs: Date.now() - startedAt });
  });

  const method = (req.method || 'GET').toUpperCase();
  const requestUrl = parseUrl(req);
  const pathname = requestUrl.pathname;


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
      await handleGetDashboardSummary(req, res, requestUrl);
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

    if (method === 'GET' && (pathname === '/api/search' || pathname === '/search')) {
      await handleGlobalSearch(req, res, requestUrl);
      return;
    }

    if (method === 'GET' && (pathname === '/api/maintenance' || pathname === '/maintenance')) {
      await handleGetMaintenanceStatus(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/api/release-notes' || pathname === '/release-notes')) {
      await handleGetReleaseNotes(req, res);
      return;
    }

    if (method === 'PATCH' && (pathname === '/api/admin/release-notes' || pathname === '/admin/release-notes')) {
      await handleUpdateReleaseNotes(req, res);
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

    if (method === 'POST' && (pathname === '/api/feedback' || pathname === '/feedback')) {
      await handleCreateFeedback(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/api/admin/feedback' || pathname === '/admin/feedback')) {
      await handleListFeedback(req, res, requestUrl);
      return;
    }

    if (method === 'GET' && (pathname === '/auth/preferences' || pathname === '/api/auth/preferences')) {
      await handleGetNotificationPreferences(req, res);
      return;
    }

    if (method === 'PATCH' && (pathname === '/auth/preferences' || pathname === '/api/auth/preferences')) {
      await handleUpdateNotificationPreferences(req, res);
      return;
    }

    if (method === 'PATCH' && (pathname === '/auth/profile' || pathname === '/api/auth/profile')) {
      await handleUpdateProfile(req, res);
      return;
    }

    if (method === 'PATCH' && (pathname === '/auth/password' || pathname === '/api/auth/password')) {
      await handleChangePassword(req, res);
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

    if (method === 'GET' && (pathname === '/api/admin/dashboard' || pathname === '/admin/dashboard')) {
      await handleGetAdminDashboard(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/api/admin/users' || pathname === '/admin/users')) {
      await handleListUsers(req, res, requestUrl);
      return;
    }

    if (method === 'GET' && (pathname === '/api/admin/rounds/pending' || pathname === '/admin/rounds/pending')) {
      await handleListPendingRounds(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/api/admin/audit-logs' || pathname === '/admin/audit-logs')) {
      await handleListAuditLogs(req, res, requestUrl);
      return;
    }

    if (method === 'GET' && (pathname === '/api/admin/settings' || pathname === '/admin/settings')) {
      await handleGetAdminSettings(req, res);
      return;
    }

    if (method === 'PATCH' && (pathname === '/api/admin/settings' || pathname === '/admin/settings')) {
      await handleUpdateAdminSettings(req, res, requestId);
      return;
    }

    if (method === 'POST' && (pathname === '/api/admin/impersonation/start' || pathname === '/admin/impersonation/start')) {
      await handleStartImpersonation(req, res);
      return;
    }

    if (method === 'POST' && (pathname === '/api/admin/impersonation/stop' || pathname === '/admin/impersonation/stop')) {
      await handleStopImpersonation(req, res);
      return;
    }

    const userRoleRoute = parseUserRoleRoute(pathname);
    if (method === 'PATCH' && userRoleRoute) {
      await handleUpdateUserRole(req, res, requestId, userRoleRoute.userId);
      return;
    }

    // ── Batch Jobs ─────────────────────────────────────────────────────────
    if (method === 'POST' && (pathname === '/api/admin/batch/recalculate-all' || pathname === '/admin/batch/recalculate-all')) {
      await handleRecalculateAllHandicaps(req, res);
      return;
    }

    if (method === 'GET' && (pathname === '/api/admin/batch/jobs' || pathname === '/admin/batch/jobs')) {
      await handleListBatchJobs(req, res);
      return;
    }

    const batchJobRoute = pathname.match(/^\/(?:api\/)?admin\/batch\/jobs\/([a-z0-9_]+)$/);
    if (batchJobRoute && method === 'GET') {
      const jobId = String(batchJobRoute[1] || '');
      await handleGetBatchJobStatus(req, res, jobId);
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

    if (method === 'POST' && (pathname === '/api/players/import' || pathname === '/players/import')) {
      await handleImportPlayers(req, res);
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

    if (teeConfigRoute && method === 'DELETE') {
      await handleDeleteTeeConfiguration(req, res, teeConfigRoute.configId);
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

    if (method === 'POST' && (pathname === '/api/rounds/import' || pathname === '/rounds/import')) {
      await handleImportRounds(req, res);
      return;
    }

    const roundRoute = parseRoundRoute(pathname);
    if (roundRoute && method === 'GET') {
      await handleGetRound(req, res, roundRoute.roundId);
      return;
    }

    if (roundRoute && method === 'PATCH') {
      await handleUpdateRound(req, res, roundRoute.roundId);
      return;
    }

    if (roundRoute && method === 'DELETE') {
      await handleDeleteRound(req, res, roundRoute.roundId);
      return;
    }

    const roundModerationRoute = parseRoundModerationRoute(pathname);
    if (roundModerationRoute && method === 'POST' && roundModerationRoute.action === 'approve') {
      await handleApproveRound(req, res, roundModerationRoute.roundId);
      return;
    }

    if (roundModerationRoute && method === 'POST' && roundModerationRoute.action === 'reject') {
      await handleRejectRound(req, res, roundModerationRoute.roundId);
      return;
    }

    const adminTeeConfigurationPccRoute = parseAdminTeeConfigurationPccRoute(pathname);
    if (adminTeeConfigurationPccRoute && method === 'PATCH') {
      await handleUpsertDailyPcc(req, res, adminTeeConfigurationPccRoute.configId);
      return;
    }

    const handicapCalculateRoute = parseHandicapCalculateRoute(pathname);
    if (handicapCalculateRoute && method === 'POST') {
      await handleCalculateHandicap(req, res, handicapCalculateRoute.playerId);
      return;
    }

    const handicapEligibilityRoute = parseHandicapEligibilityRoute(pathname);
    if (handicapEligibilityRoute && method === 'GET') {
      await handleGetHandicapEligibility(req, res, handicapEligibilityRoute.playerId);
      return;
    }

    const handicapHistoryRoute = parseHandicapHistoryRoute(pathname);
    if (handicapHistoryRoute && method === 'GET') {
      await handleGetHandicapHistory(req, res, handicapHistoryRoute.playerId);
      return;
    }

    const handicapOverrideRoute = parseHandicapOverrideRoute(pathname);
    if (handicapOverrideRoute && method === 'POST') {
      await handleCreateHandicapOverride(req, res, handicapOverrideRoute.playerId);
      return;
    }
    if (handicapOverrideRoute && method === 'GET') {
      await handleListHandicapOverrides(req, res, handicapOverrideRoute.playerId);
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
}

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  // Keep body parsing in existing route handlers to avoid behavioral changes.
  app.use((req: Request, res: Response, next: NextFunction) => {
    void dispatchRequest(req, res).catch(next);
  });

  app.use(errorHandler);

  return app;
}
