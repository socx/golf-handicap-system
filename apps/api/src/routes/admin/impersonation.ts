import http from 'node:http';
import { dbPool } from '../../lib/db';
import { logApplicationEvent } from '../../lib/audit';
import { getBearerToken, getClientIp, readJsonBody, sendError, sendJson } from '../../lib/http';
import { buildAuthTokens, verifyJwt } from '../../lib/tokens';
import { verifyAndAuthorize } from '../../middleware/auth';

interface SessionUser {
  id: string;
  email: string;
  role: 'admin' | 'player' | 'viewer';
  is_active: boolean;
  player_id: string | null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getSessionUserById(userId: string): Promise<SessionUser | null> {
  const result = await dbPool.query<SessionUser>(
    `SELECT u.id, u.email::text AS email, u.role, u.is_active, p.id AS player_id
     FROM users u
     LEFT JOIN players p ON p.user_id = u.id AND p.deleted_at IS NULL
     WHERE u.id = $1 AND u.deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  return Number(result.rowCount || 0) > 0 ? result.rows[0] : null;
}

export async function handleStartImpersonation(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendError(res, 400, 'invalid_json', (error as Error).message);
    return;
  }

  const targetUserId = typeof payload.userId === 'string' ? payload.userId.trim() : '';
  if (!isUuid(targetUserId)) {
    sendError(res, 400, 'validation_error', 'userId must be a valid UUID');
    return;
  }

  const targetUser = await getSessionUserById(targetUserId);
  if (!targetUser || !targetUser.is_active) {
    sendError(res, 404, 'not_found', 'Target user not found or inactive');
    return;
  }

  const tokens = buildAuthTokens({
    id: targetUser.id,
    email: targetUser.email,
    role: targetUser.role,
    is_active: targetUser.is_active,
    created_at: '',
    updated_at: '',
  }, {
    impersonatedBy: authResult.auth.userId,
    originalSub: authResult.auth.userId,
  });

  await logApplicationEvent({
    requestId: String(req.headers['x-request-id'] || ''),
    event: 'admin_impersonation_started',
    ipAddress: getClientIp(req),
    actorUserId: authResult.auth.userId,
    userId: targetUser.id,
    metadata: {
      targetUserId: targetUser.id,
      targetRole: targetUser.role,
    },
  });

  sendJson(res, 200, {
    user: {
      ...targetUser,
      impersonated_by: authResult.auth.userId,
      original_user_id: authResult.auth.userId,
    },
    tokens,
    message: 'Impersonation started',
  });
}

export async function handleStopImpersonation(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    sendError(res, 401, 'unauthorized', 'Missing token');
    return;
  }

  let claims: Record<string, unknown>;
  try {
    claims = verifyJwt(token) as unknown as Record<string, unknown>;
  } catch {
    sendError(res, 401, 'unauthorized', 'Invalid token');
    return;
  }

  const originalUserId = typeof claims.impersonatedBy === 'string'
    ? claims.impersonatedBy
    : typeof claims.originalSub === 'string'
      ? claims.originalSub
      : '';

  if (!isUuid(originalUserId)) {
    sendError(res, 400, 'validation_error', 'Current session is not impersonating another user');
    return;
  }

  const originalUser = await getSessionUserById(originalUserId);
  if (!originalUser || !originalUser.is_active || originalUser.role !== 'admin') {
    sendError(res, 403, 'forbidden', 'Original admin account is unavailable');
    return;
  }

  const tokens = buildAuthTokens({
    id: originalUser.id,
    email: originalUser.email,
    role: originalUser.role,
    is_active: originalUser.is_active,
    created_at: '',
    updated_at: '',
  });

  await logApplicationEvent({
    requestId: String(req.headers['x-request-id'] || ''),
    event: 'admin_impersonation_stopped',
    ipAddress: getClientIp(req),
    actorUserId: originalUser.id,
    metadata: {
      resumedAdminUserId: originalUser.id,
    },
  });

  sendJson(res, 200, {
    user: {
      ...originalUser,
      impersonated_by: null,
      original_user_id: null,
    },
    tokens,
    message: 'Returned to admin account',
  });
}
