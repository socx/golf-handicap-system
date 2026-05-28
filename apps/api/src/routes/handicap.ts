import http from 'node:http';
import { dbPool } from '../lib/db';
import { sendError, sendJson } from '../lib/http';
import { verifyAndAuthorize } from '../middleware/auth';
import {
  applyWhsCaps,
  calculateEligibleHoles,
  calculateHandicapFromDifferentials,
  MINIMUM_ELIGIBLE_HOLES,
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
       AND score_differential IS NOT NULL
     ORDER BY played_at DESC, created_at DESC
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

export async function handleGetHandicapEligibility(
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

  const player = await getPlayerForHandicap(playerId);
  if (!player) {
    sendError(res, 404, 'not_found', 'Player not found');
    return;
  }

  const allEligibleRounds = await getPlayerRoundDifferentials(playerId);
  const totalEligibleHoles = calculateEligibleHoles(allEligibleRounds);

  if (totalEligibleHoles < MINIMUM_ELIGIBLE_HOLES) {
    sendJson(res, 200, {
      playerId,
      eligibilityStatus: 'insufficient_holes',
      totalEligibleHoles,
      minimumRequiredHoles: MINIMUM_ELIGIBLE_HOLES,
    });
    return;
  }

  const roundDifferentials = await getPlayerRoundDifferentials(playerId, { limit: 20 });

  const selection = calculateHandicapFromDifferentials(roundDifferentials);
  if (!selection) {
    sendJson(res, 200, {
      playerId,
      eligibilityStatus: 'insufficient_rounds',
      roundsConsidered: roundDifferentials.length,
      minimumRoundsRequired: 3,
      effectiveDifferentials: [],
    });
    return;
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

    sendJson(res, 200, {
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
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[handicap.calculate] unexpected error:', error);
    sendError(res, 500, 'handicap_calculation_failed', 'Unable to calculate handicap at this time');
  } finally {
    client.release();
  }
}

export async function handleGetHandicapHistory(
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