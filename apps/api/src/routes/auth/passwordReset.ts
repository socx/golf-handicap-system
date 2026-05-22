import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import http from 'node:http';
import { sendJson, sendError, readJsonBody, getClientIp } from '../../lib/http';
import { dbPool } from '../../lib/db';
import { logAuthAuditEvent } from '../../lib/audit';
import { sendTemplatedEmail } from '../../lib/email';
import { env } from '../../config/env';

export async function handlePasswordResetRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string,
): Promise<void> {
  const clientIp = getClientIp(req);
  const body = await readJsonBody(req);
  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const safeResponse = { message: 'If that email is registered you will receive a reset link shortly.' };

  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    sendJson(res, 200, safeResponse);
    return;
  }

  try {
    const userResult = await dbPool.query(
      'SELECT id, email::text AS email FROM users WHERE email = $1 AND deleted_at IS NULL AND is_active = TRUE',
      [rawEmail],
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      await dbPool.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [user.id],
      );

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + env.passwordResetTokenExpiryMinutes * 60 * 1000);
      await dbPool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt],
      );

      const resetUrl = `${env.appUrl}/reset-password?token=${rawToken}`;
      await sendTemplatedEmail({
        to: user.email,
        template: 'password_reset',
        data: {
          resetUrl,
          expiresMinutes: env.passwordResetTokenExpiryMinutes,
        },
      });

      await logAuthAuditEvent({
        requestId,
        event: 'auth_password_reset_requested',
        userId: user.id,
        ipAddress: clientIp,
        metadata: {},
      });
    }
  } catch (error) {
    console.error('[password-reset.request] error:', error);
  }

  sendJson(res, 200, safeResponse);
}

export async function handlePasswordResetConfirm(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string,
): Promise<void> {
  const clientIp = getClientIp(req);
  const body = await readJsonBody(req);
  const rawToken = typeof body.token === 'string' ? body.token.trim() : '';
  const newPassword = typeof body.password === 'string' ? body.password : '';

  if (!rawToken || !newPassword) {
    sendError(res, 400, 'validation_error', 'token and password are required');
    return;
  }

  if (newPassword.length < 8) {
    sendError(res, 400, 'validation_error', 'password must be at least 8 characters');
    return;
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenResult = await dbPool.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1 AND u.deleted_at IS NULL AND u.is_active = TRUE`,
      [tokenHash],
    );

    if (tokenResult.rows.length === 0) {
      sendError(res, 400, 'invalid_token', 'Token is invalid or has expired');
      return;
    }

    const tokenRow = tokenResult.rows[0];
    if (tokenRow.used_at !== null) {
      sendError(res, 400, 'invalid_token', 'Token has already been used');
      return;
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      sendError(res, 400, 'invalid_token', 'Token has expired');
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await dbPool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, tokenRow.user_id],
    );
    await dbPool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenRow.id]);

    await logAuthAuditEvent({
      requestId,
      event: 'auth_password_reset_completed',
      userId: tokenRow.user_id,
      ipAddress: clientIp,
      metadata: {},
    });

    sendJson(res, 200, { message: 'Password reset successfully' });
  } catch (error) {
    console.error('[password-reset.confirm] error:', error);
    sendError(res, 500, 'internal_error', 'Unable to reset password');
  }
}
