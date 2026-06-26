import http from 'node:http';
import { sendJson, sendError, getBearerToken } from '../../lib/http';
import { verifyJwt } from '../../lib/tokens';
import { dbPool } from '../../lib/db';

interface AuthSessionUser {
  id: string;
  email: string;
  role: 'admin' | 'player' | 'viewer';
  is_active: boolean;
  player_id: string | null;
  impersonated_by?: string | null;
  original_user_id?: string | null;
}

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
    const result = await dbPool.query<AuthSessionUser>(
      `SELECT u.id, u.email::text AS email, u.role, u.is_active, p.id AS player_id
       FROM users u
       LEFT JOIN players p ON p.user_id = u.id AND p.deleted_at IS NULL
       WHERE u.id = $1 AND u.deleted_at IS NULL
       LIMIT 1`,
      [claims.sub],
    );

    const user = result.rows[0] ?? null;
    if (!user || !user.is_active) {
      sendError(res, 401, 'unauthorized', 'User not found or inactive');
      return;
    }

    const claimsMap = claims as unknown as Record<string, unknown>;
    const impersonatedBy = typeof claimsMap.impersonatedBy === 'string'
      ? String(claimsMap.impersonatedBy)
      : null;

    sendJson(res, 200, {
      user: {
        ...user,
        impersonated_by: impersonatedBy,
        original_user_id: impersonatedBy,
      },
    });
  } catch (error) {
    console.error('[auth.me] unexpected error:', error);
    sendError(res, 500, 'internal_error', 'Unable to retrieve session');
  }
}
