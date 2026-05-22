import http from 'node:http';
import bcrypt from 'bcryptjs';
import type { User, ValidationError, ValidationResult } from '@ghs/types';
import { sendJson, sendError, readJsonBody, getClientIp } from '../../lib/http';
import { buildAuthTokens } from '../../lib/tokens';
import { dbPool } from '../../lib/db';
import { logAuthAuditEvent } from '../../lib/audit';

function validateLoginInput(
  payload: Record<string, unknown>,
): ValidationResult<{ email: string; password: string }> {
  const errors: ValidationError[] = [];
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!email) errors.push({ field: 'email', message: 'Email is required' });
  if (!password) errors.push({ field: 'password', message: 'Password is required' });

  return { errors, value: { email, password } };
}

async function findUserByEmail(email: string): Promise<User | null> {
  const result = await dbPool.query(
    `SELECT id, email::text AS email, password_hash, role, is_active, created_at, updated_at
     FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
    [email],
  );
  return (result.rows[0] as User | undefined) || null;
}

export async function handleLogin(
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

  const validation = validateLoginInput(payload);
  if (validation.errors.length > 0) {
    sendError(res, 400, 'validation_error', 'Request validation failed', validation.errors);
    return;
  }

  try {
    const user = await findUserByEmail(validation.value.email);
    const isValidPassword = user
      ? await bcrypt.compare(validation.value.password, user.password_hash || '')
      : false;

    if (!user || !user.is_active || !isValidPassword) {
      await logAuthAuditEvent({
        requestId,
        event: 'auth_login_failure',
        userId: user?.id || null,
        ipAddress: clientIp,
        metadata: { reason: 'invalid_credentials' },
      });
      sendError(res, 401, 'invalid_credentials', 'Invalid email or password');
      return;
    }

    const responseUser: User = {
      id: user.id,
      email: user.email,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    await logAuthAuditEvent({
      requestId,
      event: 'auth_login_success',
      userId: responseUser.id,
      ipAddress: clientIp,
      metadata: { role: responseUser.role },
    });

    sendJson(res, 200, { user: responseUser, tokens: buildAuthTokens(responseUser) });
  } catch (error) {
    console.error('[auth.login] unexpected error:', error);
    sendError(res, 500, 'login_failed', 'Unable to login at this time');
  }
}
