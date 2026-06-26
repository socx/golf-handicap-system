import bcrypt from 'bcryptjs';
import http from 'node:http';
import { sendJson, sendError, readJsonBody } from '../../lib/http';
import { verifyAndAuthorize } from '../../middleware/auth';
import { dbPool } from '../../lib/db';

const NOTIFICATION_FIELDS = [
  'handicap_updates_enabled',
  'round_submitted_enabled',
  'round_approved_enabled',
  'marketing_enabled',
  'theme_mode',
] as const;

type NotificationField = (typeof NOTIFICATION_FIELDS)[number];
type NotificationPreferenceValue = boolean | 'light' | 'dark' | 'system';

export interface NotificationPreferences {
  handicap_updates_enabled: boolean;
  round_submitted_enabled: boolean;
  round_approved_enabled: boolean;
  marketing_enabled: boolean;
  theme_mode: 'light' | 'dark' | 'system';
}

export async function handleGetNotificationPreferences(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player', 'viewer'] });
  if (!authResult.success || !authResult.auth) {
    sendJson(res, authResult.statusCode || 401, {
      error: { code: authResult.errorCode, message: authResult.errorMessage },
    });
    return;
  }

  try {
    const result = await dbPool.query<NotificationPreferences>(
      `SELECT handicap_updates_enabled, round_submitted_enabled, round_approved_enabled, marketing_enabled
              , theme_mode
       FROM notification_preferences WHERE user_id = $1`,
      [authResult.auth.userId],
    );

    const preferences: NotificationPreferences = result.rows[0] ?? {
      handicap_updates_enabled: true,
      round_submitted_enabled: true,
      round_approved_enabled: true,
      marketing_enabled: false,
      theme_mode: 'system',
    };

    sendJson(res, 200, { preferences });
  } catch (error) {
    console.error('[settings.getNotificationPreferences] error:', error);
    sendError(res, 500, 'internal_error', 'Unable to retrieve notification preferences');
  }
}

export async function handleUpdateNotificationPreferences(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player', 'viewer'] });
  if (!authResult.success || !authResult.auth) {
    sendJson(res, authResult.statusCode || 401, {
      error: { code: authResult.errorCode, message: authResult.errorMessage },
    });
    return;
  }

  const body = await readJsonBody(req);
  const updates: Partial<Record<NotificationField, NotificationPreferenceValue>> = {};
  for (const field of NOTIFICATION_FIELDS) {
    if (field === 'theme_mode') {
      if (typeof body[field] === 'string' && ['light', 'dark', 'system'].includes(body[field] as string)) {
        updates[field] = body[field] as 'light' | 'dark' | 'system';
      }
      continue;
    }

    if (typeof body[field] === 'boolean') {
      updates[field] = body[field] as boolean;
    }
  }

  if (Object.keys(updates).length === 0) {
    sendError(res, 400, 'validation_error', 'At least one preference field must be provided');
    return;
  }

  try {
    const fieldNames = Object.keys(updates) as NotificationField[];
    const insertValues = NOTIFICATION_FIELDS.map((field) =>
      field in updates
        ? updates[field]
        : field === 'marketing_enabled'
          ? false
          : field === 'theme_mode'
            ? 'system'
            : true,
    );
    const setClauses = fieldNames
      .map((field) => `${field} = EXCLUDED.${field}`)
      .concat('updated_at = NOW()')
      .join(', ');

    const result = await dbPool.query<NotificationPreferences>(
      `INSERT INTO notification_preferences (
         user_id,
         handicap_updates_enabled,
         round_submitted_enabled,
         round_approved_enabled,
         marketing_enabled,
         theme_mode
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE
       SET ${setClauses}
       RETURNING handicap_updates_enabled, round_submitted_enabled, round_approved_enabled, marketing_enabled, theme_mode`,
      [authResult.auth.userId, ...insertValues],
    );

    sendJson(res, 200, { preferences: result.rows[0] });
  } catch (error) {
    console.error('[settings.updateNotificationPreferences] error:', error);
    sendError(res, 500, 'internal_error', 'Unable to update notification preferences');
  }
}

export async function handleUpdateProfile(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player', 'viewer'] });
  if (!authResult.success || !authResult.auth) {
    sendJson(res, authResult.statusCode || 401, {
      error: { code: authResult.errorCode, message: authResult.errorMessage },
    });
    return;
  }

  const body = await readJsonBody(req);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    sendError(res, 400, 'validation_error', 'A valid email address is required');
    return;
  }

  try {
    const conflict = await dbPool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2 AND deleted_at IS NULL',
      [email, authResult.auth.userId],
    );
    if (conflict.rows.length > 0) {
      sendError(res, 409, 'email_taken', 'Email address is already in use');
      return;
    }

    const result = await dbPool.query<{ email: string }>(
      'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2 RETURNING email::text AS email',
      [email, authResult.auth.userId],
    );

    sendJson(res, 200, { email: result.rows[0].email });
  } catch (error) {
    console.error('[settings.updateProfile] error:', error);
    sendError(res, 500, 'internal_error', 'Unable to update profile');
  }
}

export async function handleChangePassword(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player', 'viewer'] });
  if (!authResult.success || !authResult.auth) {
    sendJson(res, authResult.statusCode || 401, {
      error: { code: authResult.errorCode, message: authResult.errorMessage },
    });
    return;
  }

  const body = await readJsonBody(req);
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    sendError(res, 400, 'validation_error', 'currentPassword and newPassword are required');
    return;
  }

  if (newPassword.length < 8) {
    sendError(res, 400, 'validation_error', 'New password must be at least 8 characters');
    return;
  }

  try {
    const userResult = await dbPool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE',
      [authResult.auth.userId],
    );

    if (userResult.rows.length === 0) {
      sendError(res, 401, 'unauthorized', 'User not found');
      return;
    }

    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash || '',
    );
    if (!isCurrentValid) {
      sendError(res, 400, 'invalid_password', 'Current password is incorrect');
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await dbPool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
      newHash,
      authResult.auth.userId,
    ]);

    sendJson(res, 200, { message: 'Password changed successfully' });
  } catch (error) {
    console.error('[settings.changePassword] error:', error);
    sendError(res, 500, 'internal_error', 'Unable to change password');
  }
}
