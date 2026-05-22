import http from 'node:http';
import bcrypt from 'bcryptjs';
import type { User, ValidationError, ValidationResult } from '@ghs/types';
import { sendJson, sendError, readJsonBody } from '../../lib/http';
import { buildAuthTokens } from '../../lib/tokens';
import { dbPool } from '../../lib/db';
import { env } from '../../config/env';

function validateRegistrationInput(
  payload: Record<string, unknown>,
): ValidationResult<{ email: string; password: string; role: string }> {
  const errors: ValidationError[] = [];
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  const role = typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : 'player';

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ field: 'email', message: 'Email must be a valid address' });
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (password.length < 8) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
  }

  if (!['player', 'admin'].includes(role)) {
    errors.push({ field: 'role', message: 'Role must be one of: player, admin' });
  }

  return { errors, value: { email, password, role } };
}

async function registerUser(payload: { email: string; password: string; role: string }): Promise<User> {
  const passwordHash = await bcrypt.hash(payload.password, 12);
  const result = await dbPool.query(
    `INSERT INTO users (email, password_hash, role, is_active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id, email::text AS email, role, is_active, created_at, updated_at`,
    [payload.email, passwordHash, payload.role],
  );
  return result.rows[0] as User;
}

export async function handleRegister(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendError(res, 400, 'invalid_json', (error as Error).message);
    return;
  }

  const validation = validateRegistrationInput(payload);
  if (validation.errors.length > 0) {
    sendError(res, 400, 'validation_error', 'Request validation failed', validation.errors);
    return;
  }

  try {
    const user = await registerUser(validation.value);
    const responseBody: Record<string, unknown> = { user };
    if (env.authAutoLoginEnabled) {
      responseBody.tokens = buildAuthTokens(user);
    }
    sendJson(res, 201, responseBody);
  } catch (error) {
    const err = error as Record<string, unknown>;
    if (err && err.code === '23505') {
      sendError(res, 409, 'email_already_exists', 'A user with this email already exists');
      return;
    }
    console.error('[auth.register] unexpected error:', error);
    sendError(res, 500, 'registration_failed', 'Unable to register user at this time');
  }
}
