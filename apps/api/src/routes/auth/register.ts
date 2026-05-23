import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { User, ValidationError, ValidationResult } from '@ghs/types';
import { sendJson, sendError, readJsonBody } from '../../lib/http';
import { dbPool } from '../../lib/db';
import { env } from '../../config/env';
import { verifyAndAuthorize } from '../../middleware/auth';
import { sendTemplatedEmail } from '../../lib/email';

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
     VALUES ($1, $2, $3, FALSE)
     RETURNING id, email::text AS email, role, is_active, created_at, updated_at`,
    [payload.email, passwordHash, payload.role],
  );
  return result.rows[0] as User;
}

async function createActivationToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  await dbPool.query(
    `INSERT INTO account_activation_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, NOW() + ($3::text || ' hours')::interval)`,
    [userId, tokenHash, String(env.accountActivationTokenExpiryHours)],
  );

  return rawToken;
}

async function sendActivationEmail(email: string, token: string): Promise<void> {
  const appUrl = env.appUrl.replace(/\/$/, '');
  const activationUrl = `${appUrl}/auth/activate?token=${encodeURIComponent(token)}`;

  await sendTemplatedEmail({
    to: email,
    template: 'account_activation',
    data: {
      activationUrl,
      expiresHours: env.accountActivationTokenExpiryHours,
    },
  });
}

export async function handleRegister(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const adminAuth = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  const isAdminRegistration = adminAuth.success === true;

  if (!env.selfRegistrationEnabled && !isAdminRegistration) {
    sendError(res, 403, 'self_registration_disabled', 'Self-registration is disabled');
    return;
  }

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
    const role = isAdminRegistration ? validation.value.role : 'player';
    const user = await registerUser({
      email: validation.value.email,
      password: validation.value.password,
      role,
    });

    const activationToken = await createActivationToken(user.id);
    await sendActivationEmail(user.email, activationToken);

    sendJson(res, 201, {
      user,
      message: 'Registration successful. Please check your email to activate your account.',
    });
  } catch (error) {
    const err = error as Record<string, unknown>;
    if (err && err.code === '23505') {
      sendError(res, 409, 'email_already_exists', 'A user with this email already exists');
      return;
    }
    console.error('[auth.register] unexpected error:', error);
    sendError(res, 500, 'registration_failed', 'Unable to complete registration at this time');
  }
}
