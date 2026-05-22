import http from 'node:http';
import type { JWTClaims, ValidationError, ValidationResult } from '@ghs/types';
import { sendJson, sendError, readJsonBody, getBearerToken, getClientIp } from '../../lib/http';
import { markRefreshTokenBlacklisted, verifyJwt } from '../../lib/tokens';
import { logAuthAuditEvent } from '../../lib/audit';

function validateLogoutInput(
  payload: Record<string, unknown>,
): ValidationResult<{ refreshToken: string }> {
  const errors: ValidationError[] = [];
  const refreshToken = typeof payload.refreshToken === 'string' ? payload.refreshToken.trim() : '';
  if (!refreshToken) errors.push({ field: 'refreshToken', message: 'refreshToken is required' });
  return { errors, value: { refreshToken } };
}

export async function handleLogout(
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
    accessClaims = verifyJwt(accessToken);
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
    refreshClaims = verifyJwt(validation.value.refreshToken) as JWTClaims & { exp?: number };
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
      metadata: { success: true },
    });
    sendJson(res, 200, { success: true, loggedOutAt: new Date().toISOString() });
  } catch (error) {
    console.error('[auth.logout] unexpected error:', error);
    sendError(res, 500, 'logout_failed', 'Unable to logout at this time');
  }
}
