import http from 'node:http';
import { dbPool } from '../lib/db';
import { sendError, sendJson } from '../lib/http';
import { verifyAndAuthorize } from '../middleware/auth';
import { calculateHandicapFromDifferentials, type RoundDifferentialRow } from '../services/handicap';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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

  const playerResult = await dbPool.query('SELECT id FROM players WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [playerId]);
  if (Number(playerResult.rowCount || 0) === 0) {
    sendError(res, 404, 'not_found', 'Player not found');
    return;
  }

  const roundsResult = await dbPool.query(
    `SELECT id, played_at, score_differential, is_9_hole
     FROM rounds
     WHERE player_id = $1
       AND deleted_at IS NULL
       AND score_differential IS NOT NULL
     ORDER BY played_at DESC, created_at DESC
     LIMIT 20`,
    [playerId],
  );

  const roundDifferentials = roundsResult.rows.map((row) => ({
    id: String(row.id),
    played_at: String(row.played_at),
    score_differential: Number(row.score_differential),
    is_9_hole: Boolean(row.is_9_hole),
  })) as RoundDifferentialRow[];

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

    const insertResult = await client.query(
      `INSERT INTO handicap_records
       (player_id, handicap_index, num_differentials, average_differential, differentials_used, rounds_used, pcc_values, cap_adjustments)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb)
       RETURNING id, calculation_date`,
      [
        playerId,
        selection.handicapIndex,
        selection.countUsed,
        selection.averageDifferential,
        JSON.stringify(selection.selected.map((item) => item.value)),
        JSON.stringify(selection.selected.flatMap((item) => item.roundIds)),
        JSON.stringify([]),
        JSON.stringify({ multiplier: selection.multiplier, method: 'whs_selection_3_20' }),
      ],
    );

    await client.query(
      `UPDATE players
       SET handicap_index = $2, updated_at = NOW()
       WHERE id = $1`,
      [playerId, selection.handicapIndex],
    );

    await client.query('COMMIT');

    sendJson(res, 200, {
      playerId,
      eligibilityStatus: 'eligible',
      roundsConsidered: selection.roundsConsidered,
      effectiveDifferentials: selection.effectiveDifferentials,
      selection: {
        countUsed: selection.countUsed,
        selectedDifferentials: selection.selected,
        averageDifferential: selection.averageDifferential,
        multiplier: selection.multiplier,
      },
      handicapIndex: selection.handicapIndex,
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