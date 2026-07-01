import http from 'node:http';
import { dbPool } from '../lib/db';
import { sendError, sendJson } from '../lib/http';
import { verifyAndAuthorize } from '../middleware/auth';
import {
  getPlayerHandicapTrend,
  getPlayerPerformanceMetrics,
  getPlayerScoringAverages,
  getRecentPlayerRounds,
} from '../services/analytics';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getLinkedPlayerIdForUser(userId: string): Promise<string | null> {
  const result = await dbPool.query(
    'SELECT id FROM players WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1',
    [userId],
  );

  if (Number(result.rowCount || 0) === 0) {
    return null;
  }

  return String(result.rows[0].id);
}

async function resolveRequestedPlayerId(
  userRole: 'super_admin' | 'admin' | 'player' | 'viewer',
  userId: string,
  requestUrl: URL,
): Promise<string | null> {
  const requestedPlayerId = (requestUrl.searchParams.get('playerId') || '').trim();

  if (requestedPlayerId && !isUuid(requestedPlayerId)) {
    return null;
  }

  if (userRole === 'admin' || userRole === 'super_admin') {
    return requestedPlayerId || null;
  }

  const linkedPlayerId = await getLinkedPlayerIdForUser(userId);
  if (!linkedPlayerId) return null;

  if (requestedPlayerId && requestedPlayerId !== linkedPlayerId) {
    return null;
  }

  return linkedPlayerId;
}

export async function handleGetDashboardSummary(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const playerId = await resolveRequestedPlayerId(authResult.auth.role, authResult.auth.userId, requestUrl);

  if (!playerId) {
    sendError(res, 400, 'validation_error', 'A valid playerId is required for this request');
    return;
  }

  try {
    const [recentRounds, performance, scoringAverages, handicapTrend] = await Promise.all([
      getRecentPlayerRounds(playerId, 5),
      getPlayerPerformanceMetrics(playerId),
      getPlayerScoringAverages(playerId),
      getPlayerHandicapTrend(playerId, 10),
    ]);

    sendJson(res, 200, {
      playerId,
      recentRounds,
      currentHandicapIndex: handicapTrend[0]?.handicapIndex ?? null,
      handicapTrend,
      stats: {
        girPercentage: performance.girPercentage,
        firPercentage: performance.firPercentage,
        averagePutts: performance.averagePutts,
        averagePenalties: performance.averagePenalties,
        scoringAverages,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[dashboard.summary] unexpected error:', error);
    sendError(res, 500, 'dashboard_summary_failed', 'Unable to retrieve dashboard summary');
  }
}
