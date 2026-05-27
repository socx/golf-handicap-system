import http from 'node:http';
import { dbPool } from '../../lib/db';
import { getClientIp, readJsonBody, sendError, sendJson } from '../../lib/http';
import { logApplicationEvent } from '../../lib/audit';
import { verifyAndAuthorize } from '../../middleware/auth';
import { applyDailyPccToRounds, calculateDailyPcc, getPlayedOnDate, upsertDailyPcc } from '../../services/pcc';

function toPccOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export async function handleUpsertDailyPcc(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  teeConfigurationId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendError(res, 400, 'invalid_json', (error as Error).message);
    return;
  }

  const playedOnValue = String(payload.playedOn || payload.played_on || '').trim();
  const pccValue = toPccOrNull(payload.pcc);

  if (!playedOnValue) {
    sendError(res, 400, 'validation_error', 'playedOn is required', [{ field: 'playedOn', message: 'playedOn is required' }]);
    return;
  }

  let playedOn: string;
  try {
    playedOn = getPlayedOnDate(playedOnValue);
  } catch {
    sendError(res, 400, 'validation_error', 'playedOn must be a valid ISO date or date-time', [{ field: 'playedOn', message: 'playedOn must be a valid ISO date or date-time' }]);
    return;
  }

  if (pccValue !== null && (!Number.isInteger(pccValue) || pccValue < -1 || pccValue > 3)) {
    sendError(res, 400, 'validation_error', 'pcc must be an integer between -1 and 3', [{ field: 'pcc', message: 'pcc must be an integer between -1 and 3' }]);
    return;
  }

  const courseResult = await dbPool.query(
    `SELECT tc.id
     FROM tee_configurations tc
     WHERE tc.id = $1 AND tc.deleted_at IS NULL
     LIMIT 1`,
    [teeConfigurationId],
  );

  if (Number(courseResult.rowCount || 0) === 0) {
    sendError(res, 404, 'not_found', 'Tee configuration not found');
    return;
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const calculatedPcc = pccValue === null ? await calculateDailyPcc(client, teeConfigurationId, playedOn) : pccValue;
    const source = pccValue === null ? 'calculated' : 'override';
    const dailyPcc = await upsertDailyPcc(client, teeConfigurationId, playedOn, calculatedPcc, source);
    const updatedRounds = await applyDailyPccToRounds(client, teeConfigurationId, playedOn, dailyPcc.pcc);

    await client.query('COMMIT');

    await logApplicationEvent({
      requestId: (req.headers['x-request-id'] as string) || '',
      event: source === 'override' ? 'daily_pcc_overridden' : 'daily_pcc_calculated',
      ipAddress: getClientIp(req),
      metadata: {
        teeConfigurationId,
        playedOn,
        pcc: dailyPcc.pcc,
        source,
        updatedRounds,
        actorUserId: authResult.auth.userId,
      },
    });

    sendJson(res, 200, {
      dailyPcc,
      updatedRounds,
      message: source === 'override' ? 'Daily PCC overridden successfully' : 'Daily PCC calculated successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[admin.pcc] unexpected error:', error);
    sendError(res, 500, 'daily_pcc_failed', 'Unable to update PCC at this time');
  } finally {
    client.release();
  }
}