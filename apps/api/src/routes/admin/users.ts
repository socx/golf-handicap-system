import http from 'node:http';
import type { User } from '@ghs/types';
import { sendJson, sendError, getClientIp } from '../../lib/http';
import { dbPool } from '../../lib/db';
import { logAuthAuditEvent } from '../../lib/audit';
import { redisState } from '../../lib/redis';
import { verifyAndAuthorize } from '../../middleware/auth';
import { verifyAdminAndLog } from '../../middleware/auth';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function handleListUsers(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestUrl: URL,
): Promise<void> {
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
}

export async function handleAdminStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = await verifyAdminAndLog(req);
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  sendJson(res, 200, {
    admin: true,
    userId: authResult.auth.userId,
    systemStatus: {
      redisReady: redisState.ready,
      dbPoolReady: !dbPool.ended,
      startupTime: new Date().toISOString(),
    },
    message: 'Admin status retrieved successfully',
  });
}

export async function handleUserActivation(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string,
  userId: string,
  action: 'activate' | 'deactivate',
): Promise<void> {
  const clientIp = getClientIp(req);
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(userId)) {
    sendError(res, 400, 'validation_error', 'User id must be a valid UUID');
    return;
  }

  const nextStatus = action === 'activate';
  try {
    const result = await dbPool.query(
      `UPDATE users SET is_active = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, email::text AS email, role, is_active, created_at, updated_at`,
      [userId, nextStatus],
    );
    const updatedUser = (result.rows[0] as User | undefined) || null;
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
      metadata: { is_active: updatedUser.is_active, role: updatedUser.role },
    });

    sendJson(res, 200, {
      user: updatedUser,
      message: nextStatus ? 'User activated successfully' : 'User deactivated successfully',
    });
  } catch (error) {
    console.error('[users.activation] unexpected error:', error);
    sendError(res, 500, 'activation_update_failed', 'Unable to update user activation status');
  }
}

export async function handleUserDelete(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string,
  userId: string,
): Promise<void> {
  const clientIp = getClientIp(req);
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(userId)) {
    sendError(res, 400, 'validation_error', 'User id must be a valid UUID');
    return;
  }

  try {
    const result = await dbPool.query(
      `UPDATE users SET deleted_at = NOW(), updated_at = NOW(), is_active = FALSE
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, email::text AS email, role, is_active, created_at, updated_at`,
      [userId],
    );
    const deletedUser = (result.rows[0] as User | undefined) || null;
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
      metadata: { softDeleted: true, role: deletedUser.role },
    });

    sendJson(res, 200, { user: deletedUser, message: 'User soft-deleted successfully' });
  } catch (error) {
    console.error('[users.delete] unexpected error:', error);
    sendError(res, 500, 'user_delete_failed', 'Unable to soft-delete user');
  }
}
