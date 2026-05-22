import http from 'node:http';
import type { User, ValidationError, ValidationResult, JWTClaims } from '@ghs/types';
import { sendJson, sendError, readJsonBody, getClientIp } from '../../lib/http';
import { buildAuthTokens, ensureRefreshTokenUsable, verifyJwt } from '../../lib/tokens';
import { dbPool } from '../../lib/db';
import { logAuthAuditEvent } from '../../lib/audit';

function validateRefreshInput(
  payload: Record<string, unknown>,
): ValidationResult<{ refreshToken: string }> {
  const errors: ValidationError[] = [];
  const refreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!refreshToken) errors.push({ field: 'refreshToken', message: 'refreshToken is required' });
  return { errors, value: { refreshToken } };
}

async function findUserById(id: string): Promise<User | null> {
  const result = await dbPool.query(
    `SELECT id, email::text AS email, role, is_active, created_at, updated_at
     FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return (result.rows[0] as User | undefined) || null;
}

export async function handleRefresh(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string,
): Promise<void> {
  const clientIp = getClientIp(req);

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
    decodedToken = verifyJwt(validation.value.refreshToken) as JWTClaims & { exp?: number };
  } catch {
    await logAuthAuditEvent({
      requestId,
      event: 'auth_refresh',
      ipAddress: clientIp,
      metadata: { success: false, reason: 'invalid_or_expired_refresh_token' },
    });
    sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
    return;
  }

  if (!decodedToken || decodedToken.tokenType !== 'refresh' || !decodedToken.sub) {
    await logAuthAuditEvent({
      requestId,
      event: 'auth_refresh',
      ipAddress: clientIp,
      metadata: { success: false, reason: 'invalid_refresh_token_claims' },
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
        metadata: { success: false, reason: 'refresh_token_not_usable' },
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
        metadata: { success: false, reason: 'user_not_found_or_inactive' },
      });
      sendError(res, 401, 'invalid_refresh_token', 'Invalid or expired refresh token');
      return;
    }

    await logAuthAuditEvent({
      requestId,
      event: 'auth_refresh',
      userId: user.id,
      ipAddress: clientIp,
      metadata: { success: true, role: user.role },
    });

    sendJson(res, 200, { user, tokens: buildAuthTokens(user) });
  } catch (error) {
    console.error('[auth.refresh] unexpected error:', error);
    sendError(res, 500, 'refresh_failed', 'Unable to refresh token at this time');
  }
}
