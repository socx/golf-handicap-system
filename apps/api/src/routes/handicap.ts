import http from 'node:http';
import { dbPool } from '../lib/db';
import { sendError, sendJson, readJsonBody, getClientIp } from '../lib/http';
import { logApplicationEvent } from '../lib/audit';
import { sendTemplatedEmail } from '../lib/email';
import { verifyAndAuthorize } from '../middleware/auth';
import {
  applyWhsCaps,
  calculateEligibleHoles,
  calculateHandicapFromDifferentials,
  MINIMUM_ELIGIBLE_HOLES,
  type EffectiveDifferential,
  type HandicapSelectionResult,
  type RoundDifferentialRow,
} from '../services/handicap';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getPlayerRoundDifferentials(playerId: string, options?: { limit?: number }): Promise<RoundDifferentialRow[]> {
  const limitClause = typeof options?.limit === 'number' ? 'LIMIT $2' : '';
  const queryParams = typeof options?.limit === 'number' ? [playerId, options.limit] : [playerId];
  const roundsResult = await dbPool.query(
    `SELECT id, played_at, score_differential, is_9_hole, pcc
     FROM rounds
     WHERE player_id = $1
       AND deleted_at IS NULL
       AND status = 'approved'
       AND score_differential IS NOT NULL
     ORDER BY played_at DESC, id DESC
     ${limitClause}`,
    queryParams,
  );

  return roundsResult.rows.map((row) => ({
    id: String(row.id),
    played_at: String(row.played_at),
    score_differential: Number(row.score_differential),
    is_9_hole: Boolean(row.is_9_hole),
    pcc: row.pcc === null ? null : Number(row.pcc),
  })) as RoundDifferentialRow[];
}

interface PlayerHandicapRow {
  id: string;
  handicap_index: number | null;
  low_handicap_index: number | null;
}

interface HandicapNotificationTarget {
  user_id: string | null;
  email: string | null;
  handicap_updates_enabled: boolean | null;
}

async function getPlayerForHandicap(playerId: string): Promise<PlayerHandicapRow | null> {
  const playerResult = await dbPool.query(
    'SELECT id, handicap_index, low_handicap_index FROM players WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [playerId],
  );
  if (Number(playerResult.rowCount || 0) === 0) {
    return null;
  }

  return {
    id: String(playerResult.rows[0].id),
    handicap_index: playerResult.rows[0].handicap_index === null ? null : Number(playerResult.rows[0].handicap_index),
    low_handicap_index: playerResult.rows[0].low_handicap_index === null ? null : Number(playerResult.rows[0].low_handicap_index),
  };
}

async function getLinkedPlayerIdForUser(userId: string): Promise<string | null> {
  const result = await dbPool.query(
    'SELECT id FROM players WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1',
    [userId],
  );

  if (Number(result.rowCount || 0) === 0) {
    return null;
  }

  return String(result.rows[0].id);
}

async function getHandicapNotificationTarget(playerId: string): Promise<HandicapNotificationTarget | null> {
  const result = await dbPool.query(
    `SELECT p.user_id, u.email::text AS email, np.handicap_updates_enabled
     FROM players p
     LEFT JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL
     LEFT JOIN notification_preferences np ON np.user_id = p.user_id
     WHERE p.id = $1 AND p.deleted_at IS NULL
     LIMIT 1`,
    [playerId],
  );

  if (Number(result.rowCount || 0) === 0) {
    return null;
  }

  return {
    user_id: result.rows[0].user_id ? String(result.rows[0].user_id) : null,
    email: result.rows[0].email ? String(result.rows[0].email) : null,
    handicap_updates_enabled: result.rows[0].handicap_updates_enabled === null
      ? null
      : Boolean(result.rows[0].handicap_updates_enabled),
  };
}

async function logNotificationHistory(params: {
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'sent' | 'failed' | 'skipped';
  sentAt?: string | null;
}): Promise<void> {
  await dbPool.query(
    `INSERT INTO notification_history (user_id, type, payload, sent_at, status)
     VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [params.userId, params.type, JSON.stringify(params.payload), params.sentAt || null, params.status],
  );
}

async function sendHandicapUpdateNotification(params: {
  playerId: string;
  oldIndex: number | null;
  newIndex: number;
  roundsUsed: number;
}): Promise<void> {
  if (params.oldIndex !== null && params.oldIndex === params.newIndex) {
    return;
  }

  const target = await getHandicapNotificationTarget(params.playerId);
  if (!target || !target.user_id) {
    return;
  }

  const payload = {
    playerId: params.playerId,
    oldIndex: params.oldIndex,
    newIndex: params.newIndex,
    roundsUsed: params.roundsUsed,
  };

  if (target.handicap_updates_enabled === false) {
    await logNotificationHistory({
      userId: target.user_id,
      type: 'handicap_update',
      payload: { ...payload, reason: 'preference_disabled' },
      status: 'skipped',
      sentAt: null,
    });
    return;
  }

  if (!target.email) {
    await logNotificationHistory({
      userId: target.user_id,
      type: 'handicap_update',
      payload: { ...payload, reason: 'missing_user_email' },
      status: 'failed',
      sentAt: null,
    });
    return;
  }

  try {
    await sendTemplatedEmail({
      to: target.email,
      template: 'handicap_update',
      data: {
        oldIndex: params.oldIndex,
        newIndex: params.newIndex,
        roundsUsed: params.roundsUsed,
      },
    });

    await logNotificationHistory({
      userId: target.user_id,
      type: 'handicap_update',
      payload,
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    await logNotificationHistory({
      userId: target.user_id,
      type: 'handicap_update',
      payload: {
        ...payload,
        error: error instanceof Error ? error.message : String(error),
      },
      status: 'failed',
      sentAt: null,
    });
  }
}

interface EligibleHandicapCalculationPayload {
  playerId: string;
  eligibilityStatus: 'eligible';
  totalEligibleHoles: number;
  minimumRequiredHoles: number;
  roundsConsidered: number;
  effectiveDifferentials: EffectiveDifferential[];
  selection: {
    countUsed: number;
    selectedDifferentials: HandicapSelectionResult['selected'];
    averageDifferential: number;
    multiplier: number;
  };
  currentIndex: number;
  handicapIndex: number;
  pccValues: Array<{ roundId: string; pcc: number | null }>;
  capAdjustment: {
    rawHandicapIndex: number;
    appliedHandicapIndex: number;
    softCapTriggered: boolean;
    hardCapTriggered: boolean;
    softCapThreshold: number;
    hardCapThreshold: number;
    lowHandicapIndex: number;
  };
  lowHandicapIndex: number;
  recordId: string;
  calculatedAt: string;
}

type HandicapRecalculationResult =
  | { status: 'player_not_found' }
  | {
      status: 'insufficient_holes';
      payload: {
        playerId: string;
        eligibilityStatus: 'insufficient_holes';
        totalEligibleHoles: number;
        minimumRequiredHoles: number;
      };
    }
  | {
      status: 'insufficient_rounds';
      payload: {
        playerId: string;
        eligibilityStatus: 'insufficient_rounds';
        roundsConsidered: number;
        minimumRoundsRequired: number;
        effectiveDifferentials: RoundDifferentialRow[];
      };
    }
  | { status: 'eligible'; payload: EligibleHandicapCalculationPayload };

export async function recalculateHandicapForPlayer(
  playerId: string,
  options?: { sendNotifications?: boolean },
): Promise<HandicapRecalculationResult> {
  const player = await getPlayerForHandicap(playerId);
  if (!player) {
    return { status: 'player_not_found' };
  }

  const allEligibleRounds = await getPlayerRoundDifferentials(playerId);
  const totalEligibleHoles = calculateEligibleHoles(allEligibleRounds);

  if (totalEligibleHoles < MINIMUM_ELIGIBLE_HOLES) {
    return {
      status: 'insufficient_holes',
      payload: {
        playerId,
        eligibilityStatus: 'insufficient_holes',
        totalEligibleHoles,
        minimumRequiredHoles: MINIMUM_ELIGIBLE_HOLES,
      },
    };
  }

  const roundDifferentials = await getPlayerRoundDifferentials(playerId, { limit: 20 });
  const selection = calculateHandicapFromDifferentials(roundDifferentials);
  if (!selection) {
    return {
      status: 'insufficient_rounds',
      payload: {
        playerId,
        eligibilityStatus: 'insufficient_rounds',
        roundsConsidered: roundDifferentials.length,
        minimumRoundsRequired: 3,
        effectiveDifferentials: [],
      },
    };
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const pccByRoundId = new Map(roundDifferentials.map((round) => [round.id, round.pcc]));
    const pccValues = selection.selected.flatMap((item) => item.roundIds.map((roundId) => ({
      roundId,
      pcc: pccByRoundId.get(roundId) ?? 0,
    })));

    const capApplication = applyWhsCaps(
      selection.handicapIndex,
      player.low_handicap_index === null ? player.handicap_index : player.low_handicap_index,
    );

    const capAdjustments = {
      multiplier: selection.multiplier,
      method: 'whs_selection_3_20',
      rawHandicapIndex: capApplication.rawHandicapIndex,
      appliedHandicapIndex: capApplication.appliedHandicapIndex,
      softCapTriggered: capApplication.softCapTriggered,
      hardCapTriggered: capApplication.hardCapTriggered,
      softCapThreshold: capApplication.softCapThreshold,
      hardCapThreshold: capApplication.hardCapThreshold,
      lowHandicapIndex: capApplication.lowHandicapIndex,
    };

    const insertResult = await client.query(
      `INSERT INTO handicap_records
       (player_id, handicap_index, num_differentials, average_differential, differentials_used, rounds_used, pcc_values, cap_adjustments)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
       RETURNING id, calculation_date`,
      [
        playerId,
        capApplication.appliedHandicapIndex,
        selection.countUsed,
        selection.averageDifferential,
        JSON.stringify(selection.selected.map((item) => item.value)),
        JSON.stringify(selection.selected.flatMap((item) => item.roundIds)),
        JSON.stringify(pccValues),
        JSON.stringify(capAdjustments),
      ],
    );

    await client.query(
      `UPDATE players
       SET handicap_index = $2, low_handicap_index = $3, updated_at = NOW()
       WHERE id = $1`,
      [playerId, capApplication.appliedHandicapIndex, capApplication.updatedLowHandicapIndex],
    );

    await client.query('COMMIT');

    if (options?.sendNotifications !== false) {
      await sendHandicapUpdateNotification({
        playerId,
        oldIndex: player.handicap_index,
        newIndex: capApplication.appliedHandicapIndex,
        roundsUsed: selection.selected.flatMap((item) => item.roundIds).length,
      });
    }

    return {
      status: 'eligible',
      payload: {
        playerId,
        eligibilityStatus: 'eligible',
        totalEligibleHoles,
        minimumRequiredHoles: MINIMUM_ELIGIBLE_HOLES,
        roundsConsidered: selection.roundsConsidered,
        effectiveDifferentials: selection.effectiveDifferentials,
        selection: {
          countUsed: selection.countUsed,
          selectedDifferentials: selection.selected,
          averageDifferential: selection.averageDifferential,
          multiplier: selection.multiplier,
        },
        currentIndex: capApplication.appliedHandicapIndex,
        handicapIndex: capApplication.appliedHandicapIndex,
        pccValues,
        capAdjustment: {
          rawHandicapIndex: capApplication.rawHandicapIndex,
          appliedHandicapIndex: capApplication.appliedHandicapIndex,
          softCapTriggered: capApplication.softCapTriggered,
          hardCapTriggered: capApplication.hardCapTriggered,
          softCapThreshold: capApplication.softCapThreshold,
          hardCapThreshold: capApplication.hardCapThreshold,
          lowHandicapIndex: capApplication.lowHandicapIndex,
        },
        lowHandicapIndex: capApplication.updatedLowHandicapIndex,
        recordId: String(insertResult.rows[0].id),
        calculatedAt: String(insertResult.rows[0].calculation_date),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function handleGetHandicapEligibility(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  playerId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(playerId)) {
    sendError(res, 400, 'validation_error', 'playerId must be a valid UUID', [{ field: 'playerId', message: 'playerId must be a valid UUID' }]);
    return;
  }

  if (authResult.auth.role === 'player') {
    const linkedPlayerId = await getLinkedPlayerIdForUser(authResult.auth.userId);
    if (!linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Player user is not linked to a player profile');
      return;
    }

    if (linkedPlayerId !== playerId) {
      sendError(res, 403, 'forbidden', 'Players can only access their own handicap eligibility');
      return;
    }
  }

  const player = await getPlayerForHandicap(playerId);
  if (!player) {
    sendError(res, 404, 'not_found', 'Player not found');
    return;
  }

  const roundDifferentials = await getPlayerRoundDifferentials(playerId);
  const totalEligibleHoles = calculateEligibleHoles(roundDifferentials);

  sendJson(res, 200, {
    playerId,
    totalEligibleHoles,
    minimumRequiredHoles: MINIMUM_ELIGIBLE_HOLES,
    eligibilityStatus: totalEligibleHoles >= MINIMUM_ELIGIBLE_HOLES ? 'eligible' : 'insufficient_holes',
  });
}

export async function handleCalculateHandicap(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  playerId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(playerId)) {
    sendError(res, 400, 'validation_error', 'playerId must be a valid UUID', [{ field: 'playerId', message: 'playerId must be a valid UUID' }]);
    return;
  }

  try {
    const result = await recalculateHandicapForPlayer(playerId, { sendNotifications: true });
    if (result.status === 'player_not_found') {
      sendError(res, 404, 'not_found', 'Player not found');
      return;
    }

    sendJson(res, 200, result.payload as unknown as Record<string, unknown>);
  } catch (error) {
    console.error('[handicap.calculate] unexpected error:', error);
    sendError(res, 500, 'handicap_calculation_failed', 'Unable to calculate handicap at this time');
  }
}

export async function handleGetHandicapHistory(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  playerId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(playerId)) {
    sendError(res, 400, 'validation_error', 'playerId must be a valid UUID', [{ field: 'playerId', message: 'playerId must be a valid UUID' }]);
    return;
  }

  if (authResult.auth.role === 'player') {
    const linkedPlayerId = await getLinkedPlayerIdForUser(authResult.auth.userId);
    if (!linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Player user is not linked to a player profile');
      return;
    }

    if (linkedPlayerId !== playerId) {
      sendError(res, 403, 'forbidden', 'Players can only access their own handicap history');
      return;
    }
  }

  const player = await getPlayerForHandicap(playerId);
  if (!player) {
    sendError(res, 404, 'not_found', 'Player not found');
    return;
  }

  const url = new URL(req.url || '/', `http://localhost`);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  const conditions: string[] = ['player_id = $1'];
  const queryParams: unknown[] = [playerId];

  if (fromParam) {
    const fromDate = new Date(fromParam);
    if (isNaN(fromDate.getTime())) {
      sendError(res, 400, 'validation_error', 'Invalid "from" date', [{ field: 'from', message: 'Must be a valid ISO 8601 date' }]);
      return;
    }
    queryParams.push(fromDate.toISOString());
    conditions.push(`calculation_date >= $${queryParams.length}`);
  }

  if (toParam) {
    const toDate = new Date(toParam);
    if (isNaN(toDate.getTime())) {
      sendError(res, 400, 'validation_error', 'Invalid "to" date', [{ field: 'to', message: 'Must be a valid ISO 8601 date' }]);
      return;
    }
    queryParams.push(toDate.toISOString());
    conditions.push(`calculation_date <= $${queryParams.length}`);
  }

  const result = await dbPool.query(
    `SELECT id, calculation_date, handicap_index, num_differentials, average_differential,
            differentials_used, rounds_used, pcc_values, cap_adjustments, created_at
     FROM handicap_records
     WHERE ${conditions.join(' AND ')}
     ORDER BY calculation_date DESC`,
    queryParams,
  );

  const records = result.rows.map((row) => ({
    id: String(row.id),
    calculationDate: String(row.calculation_date),
    handicapIndex: Number(row.handicap_index),
    numDifferentials: Number(row.num_differentials),
    averageDifferential: Number(row.average_differential),
    differentialsUsed: row.differentials_used,
    roundsUsed: row.rounds_used,
    pccValues: row.pcc_values,
    capAdjustments: row.cap_adjustments,
    createdAt: String(row.created_at),
  }));

  sendJson(res, 200, {
    playerId,
    total: records.length,
    records,
  });
}

export async function handleCreateHandicapOverride(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  playerId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(playerId)) {
    sendError(res, 400, 'validation_error', 'playerId must be a valid UUID', [{ field: 'playerId', message: 'playerId must be a valid UUID' }]);
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendError(res, 400, 'invalid_json', (error as Error).message);
    return;
  }

  const newIndex = typeof payload.newIndex === 'number' ? payload.newIndex : Number(payload.newIndex);
  if (!Number.isFinite(newIndex) || newIndex < -10 || newIndex > 54) {
    sendError(res, 400, 'validation_error', 'newIndex must be a number between -10 and 54', [{ field: 'newIndex', message: 'Must be between -10 and 54' }]);
    return;
  }

  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  if (!reason) {
    sendError(res, 400, 'validation_error', 'reason is required', [{ field: 'reason', message: 'Reason is required' }]);
    return;
  }

  const clientIp = getClientIp(req);

  const player = await getPlayerForHandicap(playerId);
  if (!player) {
    sendError(res, 404, 'not_found', 'Player not found');
    return;
  }

  const roundedIndex = Math.round(newIndex * 10) / 10;
  const adminUserId = authResult.auth.userId;

  await dbPool.query(
    `INSERT INTO handicap_overrides (player_id, admin_user_id, previous_index, new_index, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [playerId, adminUserId, player.handicap_index, roundedIndex, reason],
  );

  await dbPool.query(
    `UPDATE players SET handicap_index = $2, updated_at = NOW() WHERE id = $1`,
    [playerId, roundedIndex],
  );

  await logApplicationEvent({
    requestId: (req.headers['x-request-id'] as string) || '',
    event: 'handicap_override_applied',
    ipAddress: clientIp,
    metadata: {
      playerId,
      adminUserId,
      previousIndex: player.handicap_index,
      newIndex: roundedIndex,
      reason,
    },
  });

  sendJson(res, 201, {
    message: 'Handicap override applied',
    override: {
      playerId,
      adminUserId,
      previousIndex: player.handicap_index,
      newIndex: roundedIndex,
      reason,
    },
  });
}

export async function handleListHandicapOverrides(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  playerId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  if (!isUuid(playerId)) {
    sendError(res, 400, 'validation_error', 'playerId must be a valid UUID', [{ field: 'playerId', message: 'playerId must be a valid UUID' }]);
    return;
  }

  const player = await getPlayerForHandicap(playerId);
  if (!player) {
    sendError(res, 404, 'not_found', 'Player not found');
    return;
  }

  const result = await dbPool.query(
    `SELECT ho.id, ho.player_id, ho.admin_user_id, u.email AS admin_email,
            ho.previous_index, ho.new_index, ho.reason, ho.created_at
     FROM handicap_overrides ho
     LEFT JOIN users u ON u.id = ho.admin_user_id
     WHERE ho.player_id = $1
     ORDER BY ho.created_at DESC`,
    [playerId],
  );

  const overrides = result.rows.map((row) => ({
    id: String(row.id),
    playerId: String(row.player_id),
    adminUserId: String(row.admin_user_id),
    adminEmail: row.admin_email ? String(row.admin_email) : null,
    previousIndex: row.previous_index === null ? null : Number(row.previous_index),
    newIndex: Number(row.new_index),
    reason: String(row.reason),
    createdAt: String(row.created_at),
  }));

  sendJson(res, 200, {
    playerId,
    total: overrides.length,
    overrides,
  });
}