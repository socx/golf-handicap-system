import http from 'node:http';
import type { User } from '@ghs/types';
import { sendJson, sendError, getBearerToken } from '../../lib/http';
import { verifyJwt } from '../../lib/tokens';
import { dbPool } from '../../lib/db';

export async function handleMe(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const token = getBearerToken(req);
  if (!token) {
    sendError(res, 401, 'unauthorized', 'Missing or invalid authorization token');
    return;
  }

  let claims;
  try {
    claims = verifyJwt(token);
  } catch {
    sendError(res, 401, 'unauthorized', 'Invalid or expired authorization token');
    return;
  }

  if (!claims || claims.tokenType !== 'access' || !claims.sub) {
    sendError(res, 401, 'unauthorized', 'Invalid access token format');
    return;
  }

  try {
    const result = await dbPool.query(
      `SELECT id, email::text AS email, role, is_active
       FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [claims.sub],
    );

    const user = (result.rows[0] as Pick<User, 'id' | 'email' | 'role' | 'is_active'> | undefined) || null;
    if (!user || !user.is_active) {
      sendError(res, 401, 'unauthorized', 'User not found or inactive');
      return;
    }

    sendJson(res, 200, { user });
  } catch (error) {
    console.error('[auth.me] unexpected error:', error);
    sendError(res, 500, 'internal_error', 'Unable to retrieve session');
  }
}
