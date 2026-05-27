import http from 'node:http';
import { dbPool } from '../lib/db';
import { getClientIp, readJsonBody, sendError, sendJson } from '../lib/http';
import { logApplicationEvent } from '../lib/audit';
import { verifyAndAuthorize } from '../middleware/auth';

interface ValidationIssue {
  field: string;
  message: string;
}

interface HoleScoreInput {
  hole_number: number;
  strokes: number;
  putts: number | null;
  gir: boolean;
  fairway_hit: boolean | null;
  in_sand: boolean;
  penalties: number;
}

interface CreateRoundInput {
  player_id: string;
  tee_configuration_id: string;
  played_at: string;
  playing_handicap: number | null;
  hole_scores: HoleScoreInput[];
}

interface TeeHoleMetadata {
  hole_number: number;
  par: number;
  stroke_index: number;
}

interface RoundDetailRow {
  id: string;
  player_id: string;
  player_first_name: string;
  player_last_name: string;
  tee_configuration_id: string;
  played_at: string;
  playing_handicap: number | null;
  gross_score: number;
  adjusted_gross_score: number;
  score_differential: number | null;
  total_putts: number;
  total_gir: number;
  total_fairways_hit: number;
  total_penalties: number;
  is_tournament: boolean;
  is_9_hole: boolean;
  created_at: string;
  updated_at: string;
}

interface TeeConfigurationMetadataRow {
  id: string;
  course_id: string;
  course_name: string;
  name: string;
  tee_colour: string;
  hole_count: number;
  course_rating: number | null;
  slope_rating: number | null;
}

interface RoundListRow extends RoundDetailRow {
  course_id: string | null;
  course_name: string | null;
  tee_configuration_name: string | null;
  tee_colour: string | null;
}

interface RoundListFilters {
  playerId: string;
  courseId: string;
  teeConfigurationId: string;
  from: string;
  to: string;
}

function getStrokesReceivedOnHole(playingHandicap: number, holeStrokeIndex: number, holeCount: number): number {
  if (holeCount <= 0) return 0;

  if (playingHandicap >= 0) {
    const base = Math.floor(playingHandicap / holeCount);
    const remainder = playingHandicap % holeCount;
    return base + (holeStrokeIndex <= remainder ? 1 : 0);
  }

  const abs = Math.abs(playingHandicap);
  const base = -Math.floor(abs / holeCount);
  const remainder = abs % holeCount;
  if (remainder === 0) return base;

  // Plus handicap players give back strokes starting at the easiest holes.
  const easiestStrokeIndexThreshold = holeCount - remainder;
  return base + (holeStrokeIndex > easiestStrokeIndexThreshold ? -1 : 0);
}

function computeNetDoubleBogeyAdjustedScore(
  strokes: number,
  playingHandicap: number,
  hole: TeeHoleMetadata,
  holeCount: number,
): number {
  const strokesReceived = getStrokesReceivedOnHole(playingHandicap, hole.stroke_index, holeCount);
  const netDoubleBogeyCap = Math.max(1, hole.par + 2 + strokesReceived);
  return Math.min(strokes, netDoubleBogeyCap);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parsePagination(requestUrl: URL): { page: number; limit: number; offset: number } {
  const pageRaw = Number(requestUrl.searchParams.get('page') || '1');
  const limitRaw = Number(requestUrl.searchParams.get('limit') || '20');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 20;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function parseRoundListFilters(requestUrl: URL): RoundListFilters {
  return {
    playerId: (requestUrl.searchParams.get('playerId') || '').trim(),
    courseId: (requestUrl.searchParams.get('courseId') || '').trim(),
    teeConfigurationId: (requestUrl.searchParams.get('teeConfigurationId') || '').trim(),
    from: (requestUrl.searchParams.get('from') || '').trim(),
    to: (requestUrl.searchParams.get('to') || '').trim(),
  };
}

function parseDateFilter(value: string, boundary: 'start' | 'end'): string | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
    return `${value}${suffix}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function handleListRounds(req: http.IncomingMessage, res: http.ServerResponse, requestUrl: URL): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const { page, limit, offset } = parsePagination(requestUrl);
  const filters = parseRoundListFilters(requestUrl);

  if (filters.playerId && !isUuid(filters.playerId)) {
    sendError(res, 400, 'validation_error', 'playerId must be a valid UUID', [{ field: 'playerId', message: 'playerId must be a valid UUID' }]);
    return;
  }

  if (filters.courseId && !isUuid(filters.courseId)) {
    sendError(res, 400, 'validation_error', 'courseId must be a valid UUID', [{ field: 'courseId', message: 'courseId must be a valid UUID' }]);
    return;
  }

  if (filters.teeConfigurationId && !isUuid(filters.teeConfigurationId)) {
    sendError(res, 400, 'validation_error', 'teeConfigurationId must be a valid UUID', [{ field: 'teeConfigurationId', message: 'teeConfigurationId must be a valid UUID' }]);
    return;
  }

  const fromDate = filters.from ? parseDateFilter(filters.from, 'start') : null;
  if (filters.from && !fromDate) {
    sendError(res, 400, 'validation_error', 'from must be a valid ISO date/time or YYYY-MM-DD value', [{ field: 'from', message: 'from must be a valid date filter' }]);
    return;
  }

  const toDate = filters.to ? parseDateFilter(filters.to, 'end') : null;
  if (filters.to && !toDate) {
    sendError(res, 400, 'validation_error', 'to must be a valid ISO date/time or YYYY-MM-DD value', [{ field: 'to', message: 'to must be a valid date filter' }]);
    return;
  }

  const clauses = ['r.deleted_at IS NULL'];
  const params: unknown[] = [];

  if (filters.playerId) {
    params.push(filters.playerId);
    clauses.push(`r.player_id = $${params.length}`);
  }

  if (filters.courseId) {
    params.push(filters.courseId);
    clauses.push(`tc.course_id = $${params.length}`);
  }

  if (filters.teeConfigurationId) {
    params.push(filters.teeConfigurationId);
    clauses.push(`r.tee_configuration_id = $${params.length}`);
  }

  if (fromDate) {
    params.push(fromDate);
    clauses.push(`r.played_at >= $${params.length}`);
  }

  if (toDate) {
    params.push(toDate);
    clauses.push(`r.played_at <= $${params.length}`);
  }

  const whereClause = clauses.join(' AND ');

  const countResult = await dbPool.query(
    `SELECT COUNT(*)::int AS total
     FROM rounds r
     LEFT JOIN tee_configurations tc ON tc.id = r.tee_configuration_id
     LEFT JOIN courses c ON c.id = tc.course_id
     WHERE ${whereClause}`,
    params,
  );
  const total = Number(countResult.rows[0]?.total || 0);

  const listParams = [...params, limit, offset];
  const limitIndex = listParams.length - 1;
  const offsetIndex = listParams.length;

  const listResult = await dbPool.query(
    `SELECT r.id, r.player_id, p.first_name AS player_first_name, p.last_name AS player_last_name, r.tee_configuration_id, r.played_at, r.playing_handicap,
            r.gross_score, r.adjusted_gross_score, r.score_differential,
            r.total_putts, r.total_gir, r.total_fairways_hit, r.total_penalties,
            r.is_tournament, r.is_9_hole, r.created_at, r.updated_at,
            tc.course_id, c.name AS course_name, tc.name AS tee_configuration_name, tc.tee_colour
     FROM rounds r
     INNER JOIN players p ON p.id = r.player_id
     LEFT JOIN tee_configurations tc ON tc.id = r.tee_configuration_id
     LEFT JOIN courses c ON c.id = tc.course_id
     WHERE ${whereClause}
     ORDER BY r.played_at DESC, r.created_at DESC
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    listParams,
  );

  const rounds = listResult.rows.map((row) => {
    const round = row as RoundListRow;
    return {
      id: round.id,
      playerId: round.player_id,
      playerFirstName: round.player_first_name,
      playerLastName: round.player_last_name,
      teeConfigurationId: round.tee_configuration_id,
      courseId: round.course_id,
      courseName: round.course_name,
      teeConfigurationName: round.tee_configuration_name,
      teeColour: round.tee_colour,
      playedAt: round.played_at,
      playingHandicap: round.playing_handicap === null ? null : Number(round.playing_handicap),
      grossScore: round.gross_score,
      adjustedGrossScore: round.adjusted_gross_score,
      scoreDifferential: round.score_differential === null ? null : Number(round.score_differential),
      totals: {
        putts: round.total_putts,
        gir: round.total_gir,
        fairwaysHit: round.total_fairways_hit,
        penalties: round.total_penalties,
      },
      flags: {
        isTournament: round.is_tournament,
        is9Hole: round.is_9_hole,
      },
      createdAt: round.created_at,
      updatedAt: round.updated_at,
    };
  });

  sendJson(res, 200, {
    rounds,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
}

function validateCreateRoundPayload(payload: Record<string, unknown>): { errors: ValidationIssue[]; value: CreateRoundInput | null } {
  const errors: ValidationIssue[] = [];

  const playerId = typeof payload.playerId === 'string' ? payload.playerId.trim() : '';
  const teeConfigurationId = typeof payload.teeConfigurationId === 'string' ? payload.teeConfigurationId.trim() : '';
  const playedAt = typeof payload.playedAt === 'string' ? payload.playedAt.trim() : '';
  const playingHandicap = toNumberOrNull(payload.playingHandicap);

  if (!playerId || !isUuid(playerId)) {
    errors.push({ field: 'playerId', message: 'playerId must be a valid UUID' });
  }

  if (!teeConfigurationId || !isUuid(teeConfigurationId)) {
    errors.push({ field: 'teeConfigurationId', message: 'teeConfigurationId must be a valid UUID' });
  }

  if (!playedAt) {
    errors.push({ field: 'playedAt', message: 'playedAt is required' });
  } else {
    const parsedDate = new Date(playedAt);
    if (Number.isNaN(parsedDate.getTime())) {
      errors.push({ field: 'playedAt', message: 'playedAt must be a valid ISO date/time string' });
    }
  }

  if (Number.isNaN(playingHandicap)) {
    errors.push({ field: 'playingHandicap', message: 'playingHandicap must be numeric when provided' });
  }

  if (!Array.isArray(payload.holeScores) || payload.holeScores.length === 0) {
    errors.push({ field: 'holeScores', message: 'holeScores must be a non-empty array' });
  }

  const holeScores: HoleScoreInput[] = [];
  if (Array.isArray(payload.holeScores)) {
    for (let index = 0; index < payload.holeScores.length; index += 1) {
      const rawHole = payload.holeScores[index];
      if (!rawHole || typeof rawHole !== 'object') {
        errors.push({ field: `holeScores[${index}]`, message: 'Each hole score entry must be an object' });
        continue;
      }

      const hole = rawHole as Record<string, unknown>;
      const holeNumber = Number(hole.holeNumber);
      const strokes = Number(hole.strokes);
      const putts = toNumberOrNull(hole.putts);
      const penalties = hole.penalties === undefined ? 0 : Number(hole.penalties);
      const gir = hole.gir === undefined ? false : Boolean(hole.gir);
      const fairwayHit = hole.fairwayHit === undefined || hole.fairwayHit === null ? null : Boolean(hole.fairwayHit);
      const inSand = hole.inSand === undefined ? false : Boolean(hole.inSand);

      if (!Number.isInteger(holeNumber) || holeNumber < 1 || holeNumber > 18) {
        errors.push({ field: `holeScores[${index}].holeNumber`, message: 'holeNumber must be an integer between 1 and 18' });
      }

      if (!Number.isInteger(strokes) || strokes < 1) {
        errors.push({ field: `holeScores[${index}].strokes`, message: 'strokes must be an integer >= 1' });
      }

      if (Number.isNaN(putts) || (putts !== null && (!Number.isInteger(putts) || putts < 0))) {
        errors.push({ field: `holeScores[${index}].putts`, message: 'putts must be null or an integer >= 0' });
      }

      if (!Number.isInteger(penalties) || penalties < 0) {
        errors.push({ field: `holeScores[${index}].penalties`, message: 'penalties must be an integer >= 0' });
      }

      holeScores.push({
        hole_number: holeNumber,
        strokes,
        putts,
        gir,
        fairway_hit: fairwayHit,
        in_sand: inSand,
        penalties,
      });
    }

    const holeNumbers = holeScores.map((h) => h.hole_number);
    if (new Set(holeNumbers).size !== holeNumbers.length) {
      errors.push({ field: 'holeScores', message: 'holeScores.holeNumber values must be unique' });
    }
  }

  if (errors.length > 0) {
    return { errors, value: null };
  }

  return {
    errors,
    value: {
      player_id: playerId,
      tee_configuration_id: teeConfigurationId,
      played_at: playedAt,
      playing_handicap: playingHandicap,
      hole_scores: holeScores,
    },
  };
}

export async function handleCreateRound(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

  const validation = validateCreateRoundPayload(payload);
  if (validation.errors.length > 0 || !validation.value) {
    sendError(res, 400, 'validation_error', 'Request validation failed', validation.errors);
    return;
  }

  const value = validation.value;

  const configResult = await dbPool.query(
    'SELECT id, hole_count FROM tee_configurations WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [value.tee_configuration_id],
  );
  if (Number(configResult.rowCount || 0) === 0) {
    sendError(res, 404, 'not_found', 'Tee configuration not found');
    return;
  }

  const config = configResult.rows[0] as { id: string; hole_count: number };
  if (value.hole_scores.length !== config.hole_count) {
    sendError(
      res,
      400,
      'validation_error',
      `holeScores length (${value.hole_scores.length}) must match tee configuration hole_count (${config.hole_count})`,
      [{ field: 'holeScores', message: 'holeScores length must match tee configuration hole_count' }],
    );
    return;
  }

  const holeMetadataResult = await dbPool.query(
    `SELECT hole_number, par, stroke_index
     FROM holes
     WHERE tee_configuration_id = $1
     ORDER BY hole_number ASC`,
    [value.tee_configuration_id],
  );

  if (Number(holeMetadataResult.rowCount || 0) !== config.hole_count) {
    sendError(
      res,
      400,
      'validation_error',
      'Tee configuration hole metadata is incomplete',
      [{ field: 'teeConfigurationId', message: 'Tee configuration must include complete hole metadata' }],
    );
    return;
  }

  const holesByNumber = new Map<number, TeeHoleMetadata>();
  for (const row of holeMetadataResult.rows) {
    const hole = row as TeeHoleMetadata;
    holesByNumber.set(hole.hole_number, hole);
  }

  const playingHandicapForAdjustment = Math.round(value.playing_handicap ?? 0);
  const computedHoleScores = value.hole_scores.map((hole) => {
    const metadata = holesByNumber.get(hole.hole_number);
    if (!metadata) {
      return {
        ...hole,
        net_double_bogey_adjusted: hole.strokes,
        invalidHole: true,
      };
    }

    return {
      ...hole,
      net_double_bogey_adjusted: computeNetDoubleBogeyAdjustedScore(
        hole.strokes,
        playingHandicapForAdjustment,
        metadata,
        config.hole_count,
      ),
      invalidHole: false,
    };
  });

  const invalidHole = computedHoleScores.find((hole) => hole.invalidHole);
  if (invalidHole) {
    sendError(
      res,
      400,
      'validation_error',
      'holeScores contains a holeNumber not present in tee configuration',
      [{ field: 'holeScores', message: 'All holeScores.holeNumber values must exist in tee configuration holes' }],
    );
    return;
  }

  const playerResult = await dbPool.query('SELECT id FROM players WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [value.player_id]);
  if (Number(playerResult.rowCount || 0) === 0) {
    sendError(res, 404, 'not_found', 'Player not found');
    return;
  }

  const grossScore = computedHoleScores.reduce((sum, hole) => sum + hole.strokes, 0);
  const adjustedGrossScore = computedHoleScores.reduce((sum, hole) => sum + hole.net_double_bogey_adjusted, 0);
  const totalPutts = computedHoleScores.reduce((sum, hole) => sum + (hole.putts || 0), 0);
  const totalGir = computedHoleScores.reduce((sum, hole) => sum + (hole.gir ? 1 : 0), 0);
  const totalFairwaysHit = computedHoleScores.reduce((sum, hole) => sum + (hole.fairway_hit ? 1 : 0), 0);
  const totalPenalties = computedHoleScores.reduce((sum, hole) => sum + hole.penalties, 0);

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const roundInsert = await client.query(
      `INSERT INTO rounds
       (player_id, tee_configuration_id, played_at, playing_handicap, gross_score, adjusted_gross_score, score_differential, total_putts, total_gir, total_fairways_hit, total_penalties, is_tournament, is_9_hole)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, player_id, tee_configuration_id, played_at, playing_handicap, gross_score, adjusted_gross_score, score_differential, total_putts, total_gir, total_fairways_hit, total_penalties, is_tournament, is_9_hole, created_at, updated_at`,
      [
        value.player_id,
        value.tee_configuration_id,
        value.played_at,
        value.playing_handicap,
        grossScore,
        adjustedGrossScore,
        null,
        totalPutts,
        totalGir,
        totalFairwaysHit,
        totalPenalties,
        false,
        config.hole_count === 9,
      ],
    );

    const round = roundInsert.rows[0] as {
      id: string;
      player_id: string;
      tee_configuration_id: string;
      played_at: string;
      playing_handicap: number | null;
      gross_score: number;
      adjusted_gross_score: number;
      score_differential: number | null;
      total_putts: number;
      total_gir: number;
      total_fairways_hit: number;
      total_penalties: number;
      is_tournament: boolean;
      is_9_hole: boolean;
      created_at: string;
      updated_at: string;
    };

    const holeInsertResults = await Promise.all(
      computedHoleScores.map((hole) =>
        client.query(
          `INSERT INTO hole_scores
           (round_id, hole_number, strokes, putts, gir, fairway_hit, in_sand, penalties, net_double_bogey_adjusted)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, round_id, hole_number, strokes, putts, gir, fairway_hit, in_sand, penalties, net_double_bogey_adjusted, created_at, updated_at`,
          [
            round.id,
            hole.hole_number,
            hole.strokes,
            hole.putts,
            hole.gir,
            hole.fairway_hit,
            hole.in_sand,
            hole.penalties,
            hole.net_double_bogey_adjusted,
          ],
        ),
      ),
    );

    await client.query('COMMIT');

    const holeScores = holeInsertResults
      .map((result) => result.rows[0] as Record<string, unknown>)
      .sort((a, b) => Number(a.hole_number) - Number(b.hole_number))
      .map((row) => ({
        id: String(row.id),
        roundId: String(row.round_id),
        holeNumber: Number(row.hole_number),
        strokes: Number(row.strokes),
        putts: row.putts === null ? null : Number(row.putts),
        gir: Boolean(row.gir),
        fairwayHit: row.fairway_hit === null ? null : Boolean(row.fairway_hit),
        inSand: Boolean(row.in_sand),
        penalties: Number(row.penalties),
        netDoubleBogeyAdjusted: Number(row.net_double_bogey_adjusted),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
      }));

    sendJson(res, 201, {
      round: {
        id: round.id,
        playerId: round.player_id,
        teeConfigurationId: round.tee_configuration_id,
        playedAt: round.played_at,
        playingHandicap: round.playing_handicap === null ? null : Number(round.playing_handicap),
        grossScore: round.gross_score,
        adjustedGrossScore: round.adjusted_gross_score,
        scoreDifferential: round.score_differential === null ? null : Number(round.score_differential),
        totals: {
          putts: round.total_putts,
          gir: round.total_gir,
          fairwaysHit: round.total_fairways_hit,
          penalties: round.total_penalties,
        },
        flags: {
          isTournament: round.is_tournament,
          is9Hole: round.is_9_hole,
        },
        createdAt: round.created_at,
        updatedAt: round.updated_at,
      },
      holeScores,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[rounds.create] unexpected error:', error);
    sendError(res, 500, 'round_create_failed', 'Unable to create round at this time');
  } finally {
    client.release();
  }
}

export async function handleGetRound(req: http.IncomingMessage, res: http.ServerResponse, roundId: string): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const roundResult = await dbPool.query(
    `SELECT r.id, r.player_id, p.first_name AS player_first_name, p.last_name AS player_last_name, r.tee_configuration_id, r.played_at, r.playing_handicap,
            gross_score, adjusted_gross_score, score_differential,
            total_putts, total_gir, total_fairways_hit, total_penalties,
            is_tournament, is_9_hole, r.created_at, r.updated_at
     FROM rounds r
     INNER JOIN players p ON p.id = r.player_id
     WHERE r.id = $1 AND r.deleted_at IS NULL
     LIMIT 1`,
    [roundId],
  );

  if (Number(roundResult.rowCount || 0) === 0) {
    sendError(res, 404, 'not_found', 'Round not found');
    return;
  }

  const round = roundResult.rows[0] as RoundDetailRow;

  const teeConfigurationResult = await dbPool.query(
    `SELECT tc.id,
            tc.course_id,
            c.name AS course_name,
            tc.name,
            tc.tee_colour,
            tc.hole_count,
            tc.course_rating,
            tc.slope_rating
     FROM tee_configurations tc
     INNER JOIN courses c ON c.id = tc.course_id
     WHERE tc.id = $1 AND tc.deleted_at IS NULL AND c.deleted_at IS NULL
     LIMIT 1`,
    [round.tee_configuration_id],
  );

  if (Number(teeConfigurationResult.rowCount || 0) === 0) {
    sendError(res, 404, 'not_found', 'Tee configuration not found');
    return;
  }

  const teeConfiguration = teeConfigurationResult.rows[0] as TeeConfigurationMetadataRow;

  const holeScoresResult = await dbPool.query(
    `SELECT id, round_id, hole_number, strokes, putts, gir, fairway_hit, in_sand, penalties, net_double_bogey_adjusted, created_at, updated_at
     FROM hole_scores
     WHERE round_id = $1
     ORDER BY hole_number ASC`,
    [roundId],
  );

  const holeScores = holeScoresResult.rows.map((row) => ({
    id: String(row.id),
    roundId: String(row.round_id),
    holeNumber: Number(row.hole_number),
    strokes: Number(row.strokes),
    putts: row.putts === null ? null : Number(row.putts),
    gir: Boolean(row.gir),
    fairwayHit: row.fairway_hit === null ? null : Boolean(row.fairway_hit),
    inSand: Boolean(row.in_sand),
    penalties: Number(row.penalties),
    netDoubleBogeyAdjusted: Number(row.net_double_bogey_adjusted),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }));

  sendJson(res, 200, {
    round: {
      id: round.id,
      playerId: round.player_id,
      playerFirstName: round.player_first_name,
      playerLastName: round.player_last_name,
      teeConfigurationId: round.tee_configuration_id,
      playedAt: round.played_at,
      playingHandicap: round.playing_handicap === null ? null : Number(round.playing_handicap),
      grossScore: round.gross_score,
      adjustedGrossScore: round.adjusted_gross_score,
      scoreDifferential: round.score_differential === null ? null : Number(round.score_differential),
      totals: {
        putts: round.total_putts,
        gir: round.total_gir,
        fairwaysHit: round.total_fairways_hit,
        penalties: round.total_penalties,
      },
      flags: {
        isTournament: round.is_tournament,
        is9Hole: round.is_9_hole,
      },
      createdAt: round.created_at,
      updatedAt: round.updated_at,
    },
    teeConfiguration: {
      id: teeConfiguration.id,
      courseId: teeConfiguration.course_id,
      courseName: teeConfiguration.course_name,
      name: teeConfiguration.name,
      teeColour: teeConfiguration.tee_colour,
      holeCount: teeConfiguration.hole_count,
      courseRating: teeConfiguration.course_rating === null ? null : Number(teeConfiguration.course_rating),
      slopeRating: teeConfiguration.slope_rating === null ? null : Number(teeConfiguration.slope_rating),
    },
    holeScores,
  });
}

export async function handleDeleteRound(req: http.IncomingMessage, res: http.ServerResponse, roundId: string): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const requestId = (req.headers['x-request-id'] as string) || '';
  const clientIp = getClientIp(req);

  try {
    const deleteResult = await dbPool.query(
      `UPDATE rounds
       SET deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, player_id, tee_configuration_id, played_at, score_differential, deleted_at`,
      [roundId],
    );

    if (Number(deleteResult.rowCount || 0) === 0) {
      sendError(res, 404, 'not_found', 'Round not found');
      return;
    }

    const deletedRound = deleteResult.rows[0] as {
      id: string;
      player_id: string;
      tee_configuration_id: string;
      played_at: string;
      score_differential: number | null;
      deleted_at: string;
    };

    await logApplicationEvent({
      requestId,
      event: 'round_deleted',
      ipAddress: clientIp,
      metadata: {
        roundId: deletedRound.id,
        playerId: deletedRound.player_id,
        actorUserId: authResult.auth.userId,
        teeConfigurationId: deletedRound.tee_configuration_id,
        playedAt: deletedRound.played_at,
        softDeleted: true,
      },
    });

    const shouldRequestHandicapRecalculation = deletedRound.score_differential !== null;
    if (shouldRequestHandicapRecalculation) {
      await logApplicationEvent({
        requestId,
        event: 'handicap_recalculation_requested',
        ipAddress: clientIp,
        metadata: {
          reason: 'round_deleted',
          roundId: deletedRound.id,
          playerId: deletedRound.player_id,
          actorUserId: authResult.auth.userId,
          scoreDifferential: Number(deletedRound.score_differential),
        },
      });
    }

    sendJson(res, 200, {
      message: 'Round deleted',
      round: {
        id: deletedRound.id,
        playerId: deletedRound.player_id,
        teeConfigurationId: deletedRound.tee_configuration_id,
        playedAt: deletedRound.played_at,
        deletedAt: deletedRound.deleted_at,
      },
      handicapRecalculationRequested: shouldRequestHandicapRecalculation,
    });
  } catch (error) {
    console.error('[rounds.delete] unexpected error:', error);
    sendError(res, 500, 'round_delete_failed', 'Unable to delete round at this time');
  }
}
