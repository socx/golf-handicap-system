import http from 'node:http';
import crypto from 'node:crypto';
import { dbPool } from '../../lib/db';
import { readJsonBody, sendError, sendJson } from '../../lib/http';

interface ActivationInput {
  token: string;
}

function validateToken(token: unknown): token is string {
  return typeof token === 'string' && token.trim().length >= 32;
}

async function activateByToken(token: string): Promise<{ id: string; email: string; role: string; is_active: boolean } | null> {
  const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');

    const tokenResult = await client.query<{ user_id: string }>(
      `UPDATE account_activation_tokens
       SET used_at = NOW()
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       RETURNING user_id`,
      [tokenHash],
    );

    if (tokenResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const userId = tokenResult.rows[0]?.user_id;
    const userResult = await client.query<{ id: string; email: string; role: string; is_active: boolean }>(
      `UPDATE users
       SET is_active = TRUE,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, email::text AS email, role, is_active`,
      [userId],
    );

    await client.query('COMMIT');
    return userResult.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function handleActivateAccount(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  tokenFromQuery?: string,
): Promise<void> {
  let input: ActivationInput = { token: tokenFromQuery || '' };

  if (!tokenFromQuery) {
    try {
      const payload = await readJsonBody(req);
      input = {
        token: typeof payload.token === 'string' ? payload.token : '',
      };
    } catch (error) {
      sendError(res, 400, 'invalid_json', (error as Error).message);
      return;
    }
  }

  if (!validateToken(input.token)) {
    sendError(res, 400, 'validation_error', 'A valid activation token is required');
    return;
  }

  try {
    const user = await activateByToken(input.token);

    if (!user) {
      sendError(res, 400, 'invalid_or_expired_activation_token', 'Activation link is invalid or has expired');
      return;
    }

    sendJson(res, 200, {
      message: 'Account activated successfully. You can now sign in.',
      user,
    });
  } catch (error) {
    console.error('[auth.activate] unexpected error:', error);
    sendError(res, 500, 'activation_failed', 'Unable to activate account at this time');
  }
}
