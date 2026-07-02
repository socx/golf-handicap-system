import http from 'node:http';
import { env } from '../config/env';
import { dbPool } from '../lib/db';
import { sendTemplatedEmail } from '../lib/email';
import { sendEmail } from '../lib/email';
import { getClientIp, readJsonBody, sendError, sendJson } from '../lib/http';
import { logApplicationEvent } from '../lib/audit';
import { verifyAndAuthorize } from '../middleware/auth';
import { getOrCreateDailyPcc, getPlayedOnDate } from '../services/pcc';
import { recalculateHandicapForPlayer } from './handicap';
import { createImportJob } from '../lib/importJobs';

type RoundStatus = 'pending' | 'approved' | 'rejected';

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

interface UpdateRoundInput extends CreateRoundInput {}

type HandicapRecalculationResponse =
  | {
      attempted: true;
      status: 'eligible' | 'insufficient_holes' | 'insufficient_rounds';
      handicapIndex?: number;
      recordId?: string;
    }
  | {
      attempted: false;
      status: 'not_approved' | 'failed';
      reason: string;
    };

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
  status: RoundStatus;
  rejection_reason: string | null;
  gross_score: number;
  adjusted_gross_score: number;
  score_differential: number | null;
  pcc: number | null;
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

interface RoundNotificationTarget {
  user_id: string | null;
  email: string | null;
  round_submitted_enabled: boolean | null;
  round_approved_enabled: boolean | null;
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

function computeScoreDifferential(
  adjustedGrossScore: number,
  courseRating: number | null,
  slopeRating: number | null,
  pccAdjustment: number,
): number | null {
  if (courseRating === null || slopeRating === null || slopeRating <= 0) {
    return null;
  }

  const differential = (113 / slopeRating) * (adjustedGrossScore - courseRating - pccAdjustment);
  return Number(differential.toFixed(3));
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

async function getCourseNameForTeeConfiguration(teeConfigurationId: string): Promise<string> {
  const result = await dbPool.query(
    `SELECT c.name
     FROM courses c
     INNER JOIN tee_configurations tc ON tc.course_id = c.id
     WHERE tc.id = $1`,
    [teeConfigurationId],
  );

  return Number(result.rowCount || 0) > 0 ? String(result.rows[0].name) : 'Unknown Course';
}

async function getRoundNotificationTarget(playerId: string): Promise<RoundNotificationTarget | null> {
  const result = await dbPool.query<RoundNotificationTarget>(
    `SELECT p.user_id,
            u.email::text AS email,
            np.round_submitted_enabled,
            np.round_approved_enabled
     FROM players p
     LEFT JOIN users u ON u.id = p.user_id AND u.deleted_at IS NULL
     LEFT JOIN notification_preferences np ON np.user_id = p.user_id
     WHERE p.id = $1 AND p.deleted_at IS NULL
     LIMIT 1`,
    [playerId],
  );

  return result.rows[0] ?? null;
}

async function logRoundNotificationHistory(params: {
  userId: string;
  type: 'round_submitted' | 'round_updated' | 'round_approved';
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

async function sendRoundNotification(params: {
  playerId: string;
  roundId: string;
  eventType: 'round_submitted' | 'round_updated' | 'round_approved';
  status: RoundStatus;
  grossScore: number;
  adjustedGrossScore: number;
  courseName: string;
  playedAt: string;
}): Promise<void> {
  const target = await getRoundNotificationTarget(params.playerId);
  if (!target || !target.user_id) {
    return;
  }

  const payload = {
    playerId: params.playerId,
    roundId: params.roundId,
    eventType: params.eventType,
    status: params.status,
    grossScore: params.grossScore,
    adjustedGrossScore: params.adjustedGrossScore,
    courseName: params.courseName,
    playedAt: params.playedAt,
  };

  const notificationsEnabled =
    params.eventType === 'round_approved'
      ? target.round_approved_enabled !== false
      : target.round_submitted_enabled !== false;

  if (!notificationsEnabled) {
    await logRoundNotificationHistory({
      userId: target.user_id,
      type: params.eventType,
      payload,
      status: 'skipped',
      sentAt: null,
    });
    return;
  }

  if (!target.email) {
    await logRoundNotificationHistory({
      userId: target.user_id,
      type: params.eventType,
      payload: { ...payload, reason: 'missing_user_email' },
      status: 'failed',
      sentAt: null,
    });
    return;
  }

  try {
    await sendTemplatedEmail({
      to: target.email,
      template: 'round_update',
      data: {
      eventType: params.eventType,
      status: params.status,
      grossScore: params.grossScore,
      adjustedGrossScore: params.adjustedGrossScore,
      courseName: params.courseName,
      playedAt: params.playedAt,
      },
    });

    await logRoundNotificationHistory({
      userId: target.user_id,
      type: params.eventType,
      payload,
      status: 'sent',
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    await logRoundNotificationHistory({
      userId: target.user_id,
      type: params.eventType,
      payload: { ...payload, error: error instanceof Error ? error.message : String(error) },
      status: 'failed',
      sentAt: null,
    });
  }
}

async function maybeRecalculateHandicapForPlayer(
  playerId: string,
  shouldAttempt: boolean,
  reasonWhenSkipped: string,
): Promise<HandicapRecalculationResponse> {
  if (!shouldAttempt) {
    return {
      attempted: false,
      status: 'not_approved',
      reason: reasonWhenSkipped,
    };
  }

  try {
    const recalculationResult = await recalculateHandicapForPlayer(playerId, { sendNotifications: true });
    if (recalculationResult.status === 'eligible') {
      return {
        attempted: true,
        status: 'eligible',
        handicapIndex: recalculationResult.payload.handicapIndex,
        recordId: recalculationResult.payload.recordId,
      };
    }

    if (recalculationResult.status === 'insufficient_holes') {
      return {
        attempted: true,
        status: 'insufficient_holes',
      };
    }

    if (recalculationResult.status === 'insufficient_rounds') {
      return {
        attempted: true,
        status: 'insufficient_rounds',
      };
    }

    return {
      attempted: false,
      status: 'failed',
      reason: 'player_not_found',
    };
  } catch (error) {
    console.error('[rounds] handicap recalculation failed:', error);
    return {
      attempted: false,
      status: 'failed',
      reason: 'recalculation_error',
    };
  }
}

export async function handleListRounds(req: http.IncomingMessage, res: http.ServerResponse, requestUrl: URL): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player'] });
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

  if (authResult.auth.role === 'player') {
    const linkedPlayerId = await getLinkedPlayerIdForUser(authResult.auth.userId);
    if (!linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Player user is not linked to a player profile');
      return;
    }

    params.push(linkedPlayerId);
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
        r.status, r.rejection_reason, r.gross_score, r.adjusted_gross_score, r.score_differential, r.pcc,
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
      status: round.status,
      rejectionReason: round.rejection_reason,
      grossScore: round.gross_score,
      adjustedGrossScore: round.adjusted_gross_score,
      scoreDifferential: round.score_differential === null ? null : Number(round.score_differential),
      pcc: round.pcc === null ? null : Number(round.pcc),
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
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player'] });
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

  // Enforce ownership: players can only submit rounds for themselves
  if (authResult.auth.role === 'player') {
    const linkedPlayerId = await getLinkedPlayerIdForUser(authResult.auth.userId);
    if (!linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Player user is not linked to a player profile');
      return;
    }
    if (linkedPlayerId !== value.player_id) {
      sendError(res, 403, 'forbidden', 'Players can only submit rounds for their own profile');
      return;
    }
  }

  const configResult = await dbPool.query(
    'SELECT id, hole_count, course_rating, slope_rating FROM tee_configurations WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [value.tee_configuration_id],
  );
  if (Number(configResult.rowCount || 0) === 0) {
    sendError(res, 404, 'not_found', 'Tee configuration not found');
    return;
  }

  const config = configResult.rows[0] as { id: string; hole_count: number; course_rating: number | null; slope_rating: number | null };
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
  const nextStatus: RoundStatus = env.autoApproveRounds ? 'approved' : 'pending';
  const requestId = (req.headers['x-request-id'] as string) || '';
  const clientIp = getClientIp(req);
  try {
    await client.query('BEGIN');

    const dailyPcc = await getOrCreateDailyPcc(client, value.tee_configuration_id, getPlayedOnDate(value.played_at));
    const scoreDifferential = computeScoreDifferential(
      adjustedGrossScore,
      config.course_rating === null ? null : Number(config.course_rating),
      config.slope_rating === null ? null : Number(config.slope_rating),
      dailyPcc.pcc,
    );

    const roundInsert = await client.query(
      `INSERT INTO rounds
       (player_id, tee_configuration_id, played_at, playing_handicap, status, gross_score, adjusted_gross_score, score_differential, pcc, total_putts, total_gir, total_fairways_hit, total_penalties, is_tournament, is_9_hole)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, player_id, tee_configuration_id, played_at, playing_handicap, status, rejection_reason, gross_score, adjusted_gross_score, score_differential, pcc, total_putts, total_gir, total_fairways_hit, total_penalties, is_tournament, is_9_hole, created_at, updated_at`,
      [
        value.player_id,
        value.tee_configuration_id,
        value.played_at,
        value.playing_handicap,
          nextStatus,
        grossScore,
        adjustedGrossScore,
        scoreDifferential,
        dailyPcc.pcc,
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
      status: RoundStatus;
      rejection_reason: string | null;
      gross_score: number;
      adjusted_gross_score: number;
      score_differential: number | null;
      pcc: number | null;
      total_putts: number;
      total_gir: number;
      total_fairways_hit: number;
      total_penalties: number;
      is_tournament: boolean;
      is_9_hole: boolean;
      created_at: string;
      updated_at: string;
    };

    const holeInsertResults = [];
    for (const hole of computedHoleScores) {
      const holeInsertResult = await client.query(
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
      );
      holeInsertResults.push(holeInsertResult);
    }

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

    const handicapRecalculation = await maybeRecalculateHandicapForPlayer(
      value.player_id,
      nextStatus === 'approved',
      'round_pending_admin_approval',
    );

    const courseName = await getCourseNameForTeeConfiguration(value.tee_configuration_id);

    await sendRoundNotification({
      playerId: value.player_id,
      roundId: round.id,
      eventType: 'round_submitted',
      status: nextStatus,
      grossScore: grossScore,
      adjustedGrossScore: adjustedGrossScore,
      courseName: courseName,
      playedAt: value.played_at,
    });

    await logApplicationEvent({
      requestId,
      event: 'round_created',
      ipAddress: clientIp,
      metadata: {
        roundId: round.id,
        playerId: round.player_id,
        teeConfigurationId: round.tee_configuration_id,
        playedAt: round.played_at,
        status: round.status,
        actorUserId: authResult.auth.userId,
        autoApproved: env.autoApproveRounds,
      },
    });

    if (nextStatus === 'approved') {
      await logApplicationEvent({
        requestId,
        event: 'round_approved',
        ipAddress: clientIp,
        metadata: {
          roundId: round.id,
          playerId: round.player_id,
          teeConfigurationId: round.tee_configuration_id,
          playedAt: round.played_at,
          actorUserId: authResult.auth.userId,
          approvalMode: 'auto',
        },
      });
    }

    sendJson(res, 201, {
      round: {
        id: round.id,
        playerId: round.player_id,
        teeConfigurationId: round.tee_configuration_id,
        playedAt: round.played_at,
        playingHandicap: round.playing_handicap === null ? null : Number(round.playing_handicap),
        status: round.status,
        rejectionReason: round.rejection_reason,
        grossScore: round.gross_score,
        adjustedGrossScore: round.adjusted_gross_score,
        scoreDifferential: round.score_differential === null ? null : Number(round.score_differential),
        pcc: round.pcc === null ? null : Number(round.pcc),
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
      handicapRecalculation,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[rounds.create] unexpected error:', error);
    sendError(res, 500, 'round_create_failed', 'Unable to create round at this time');
  } finally {
    client.release();
  }
}

export async function handleUpdateRound(req: http.IncomingMessage, res: http.ServerResponse, roundId: string): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const existingRoundResult = await dbPool.query(
    `SELECT id, player_id, tee_configuration_id, played_at, status
     FROM rounds
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [roundId],
  );

  if (Number(existingRoundResult.rowCount || 0) === 0) {
    sendError(res, 404, 'not_found', 'Round not found');
    return;
  }

  const existingRound = existingRoundResult.rows[0] as {
    id: string;
    player_id: string;
    tee_configuration_id: string;
    played_at: string;
    status: RoundStatus;
  };

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

  const value = validation.value as UpdateRoundInput;

  let linkedPlayerId: string | null = null;
  if (authResult.auth.role === 'player') {
    linkedPlayerId = await getLinkedPlayerIdForUser(authResult.auth.userId);
    if (!linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Player user is not linked to a player profile');
      return;
    }

    if (existingRound.player_id !== linkedPlayerId || value.player_id !== linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Players can only edit their own rounds');
      return;
    }
  }

  const configResult = await dbPool.query(
    'SELECT id, hole_count, course_rating, slope_rating FROM tee_configurations WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [value.tee_configuration_id],
  );
  if (Number(configResult.rowCount || 0) === 0) {
    sendError(res, 404, 'not_found', 'Tee configuration not found');
    return;
  }

  const config = configResult.rows[0] as { id: string; hole_count: number; course_rating: number | null; slope_rating: number | null };
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

  const nextStatus: RoundStatus = env.autoApproveRounds ? 'approved' : 'pending';
  const requestId = (req.headers['x-request-id'] as string) || '';
  const clientIp = getClientIp(req);

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const dailyPcc = await getOrCreateDailyPcc(client, value.tee_configuration_id, getPlayedOnDate(value.played_at));
    const scoreDifferential = computeScoreDifferential(
      adjustedGrossScore,
      config.course_rating === null ? null : Number(config.course_rating),
      config.slope_rating === null ? null : Number(config.slope_rating),
      dailyPcc.pcc,
    );

    const roundUpdateResult = await client.query(
      `UPDATE rounds
       SET player_id = $2,
           tee_configuration_id = $3,
           played_at = $4,
           playing_handicap = $5,
           status = $6,
           rejection_reason = NULL,
           gross_score = $7,
           adjusted_gross_score = $8,
           score_differential = $9,
           pcc = $10,
           total_putts = $11,
           total_gir = $12,
           total_fairways_hit = $13,
           total_penalties = $14,
           is_tournament = FALSE,
           is_9_hole = $15,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, player_id, tee_configuration_id, played_at, playing_handicap, status, rejection_reason, gross_score, adjusted_gross_score,
                 score_differential, pcc, total_putts, total_gir, total_fairways_hit, total_penalties, is_tournament, is_9_hole, created_at, updated_at`,
      [
        roundId,
        value.player_id,
        value.tee_configuration_id,
        value.played_at,
        value.playing_handicap,
        nextStatus,
        grossScore,
        adjustedGrossScore,
        scoreDifferential,
        dailyPcc.pcc,
        totalPutts,
        totalGir,
        totalFairwaysHit,
        totalPenalties,
        config.hole_count === 9,
      ],
    );

    if (Number(roundUpdateResult.rowCount || 0) === 0) {
      await client.query('ROLLBACK');
      sendError(res, 404, 'not_found', 'Round not found');
      return;
    }

    const round = roundUpdateResult.rows[0] as {
      id: string;
      player_id: string;
      tee_configuration_id: string;
      played_at: string;
      playing_handicap: number | null;
      status: RoundStatus;
      rejection_reason: string | null;
      gross_score: number;
      adjusted_gross_score: number;
      score_differential: number | null;
      pcc: number | null;
      total_putts: number;
      total_gir: number;
      total_fairways_hit: number;
      total_penalties: number;
      is_tournament: boolean;
      is_9_hole: boolean;
      created_at: string;
      updated_at: string;
    };

    await client.query('DELETE FROM hole_scores WHERE round_id = $1', [round.id]);

    const holeInsertResults = [];
    for (const hole of computedHoleScores) {
      const holeInsertResult = await client.query(
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
      );
      holeInsertResults.push(holeInsertResult);
    }

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

    const handicapRecalculation = await maybeRecalculateHandicapForPlayer(
      value.player_id,
      nextStatus === 'approved',
      'round_pending_admin_approval',
    );

    const courseName = await getCourseNameForTeeConfiguration(value.tee_configuration_id);

    await sendRoundNotification({
      playerId: value.player_id,
      roundId: round.id,
      eventType: 'round_updated',
      status: nextStatus,
      grossScore: grossScore,
      adjustedGrossScore: adjustedGrossScore,
      courseName: courseName,
      playedAt: value.played_at,
    });

    await logApplicationEvent({
      requestId,
      event: 'round_updated',
      ipAddress: clientIp,
      metadata: {
        roundId: round.id,
        playerId: round.player_id,
        previousPlayerId: existingRound.player_id,
        teeConfigurationId: round.tee_configuration_id,
        previousStatus: existingRound.status,
        status: round.status,
        actorUserId: authResult.auth.userId,
        autoApproved: env.autoApproveRounds,
      },
    });

    if (nextStatus === 'approved') {
      await logApplicationEvent({
        requestId,
        event: 'round_approved',
        ipAddress: clientIp,
        metadata: {
          roundId: round.id,
          playerId: round.player_id,
          teeConfigurationId: round.tee_configuration_id,
          playedAt: round.played_at,
          actorUserId: authResult.auth.userId,
          approvalMode: 'auto',
          source: 'round_update',
        },
      });
    }

    sendJson(res, 200, {
      round: {
        id: round.id,
        playerId: round.player_id,
        teeConfigurationId: round.tee_configuration_id,
        playedAt: round.played_at,
        playingHandicap: round.playing_handicap === null ? null : Number(round.playing_handicap),
        status: round.status,
        rejectionReason: round.rejection_reason,
        grossScore: round.gross_score,
        adjustedGrossScore: round.adjusted_gross_score,
        scoreDifferential: round.score_differential === null ? null : Number(round.score_differential),
        pcc: round.pcc === null ? null : Number(round.pcc),
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
      handicapRecalculation,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[rounds.update] unexpected error:', error);
    sendError(res, 500, 'round_update_failed', 'Unable to update round at this time');
  } finally {
    client.release();
  }
}

export async function handleGetRound(req: http.IncomingMessage, res: http.ServerResponse, roundId: string): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const roundResult = await dbPool.query(
    `SELECT r.id, r.player_id, p.first_name AS player_first_name, p.last_name AS player_last_name, r.tee_configuration_id, r.played_at, r.playing_handicap,
          r.status, r.rejection_reason,
            gross_score, adjusted_gross_score, score_differential, pcc,
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

  if (authResult.auth.role === 'player') {
    const linkedPlayerId = await getLinkedPlayerIdForUser(authResult.auth.userId);
    if (!linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Player user is not linked to a player profile');
      return;
    }

    if (round.player_id !== linkedPlayerId) {
      sendError(res, 403, 'forbidden', 'Players can only access their own rounds');
      return;
    }
  }

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
     WHERE tc.id = $1 AND c.deleted_at IS NULL
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
      status: round.status,
      rejectionReason: round.rejection_reason,
      grossScore: round.gross_score,
      adjustedGrossScore: round.adjusted_gross_score,
      scoreDifferential: round.score_differential === null ? null : Number(round.score_differential),
      pcc: round.pcc === null ? null : Number(round.pcc),
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

    const shouldRecalculate = deletedRound.score_differential !== null;

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

    let handicapRecalculation: HandicapRecalculationResponse = {
      attempted: false,
      status: 'not_approved',
      reason: 'deleted_round_had_no_differential',
    };

    if (shouldRecalculate) {
      handicapRecalculation = await maybeRecalculateHandicapForPlayer(
        deletedRound.player_id,
        true,
        'round_deleted',
      );
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
      handicapRecalculation,
    });
  } catch (error) {
    console.error('[rounds.delete] unexpected error:', error);
    sendError(res, 500, 'round_delete_failed', 'Unable to delete round at this time');
  }
}

export async function handleApproveRound(req: http.IncomingMessage, res: http.ServerResponse, roundId: string): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const clientIp = getClientIp(req);

  try {
    const result = await dbPool.query(
      `UPDATE rounds
       SET status = 'approved', rejection_reason = NULL, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, player_id, tee_configuration_id, played_at, status, rejection_reason, score_differential`,
      [roundId],
    );

    if (Number(result.rowCount || 0) === 0) {
      sendError(res, 404, 'not_found', 'Round not found');
      return;
    }

    const approvedRound = result.rows[0] as {
      id: string;
      player_id: string;
      tee_configuration_id: string;
      played_at: string;
      status: RoundStatus;
      rejection_reason: string | null;
      score_differential: number | null;
    };

    await logApplicationEvent({
      requestId: (req.headers['x-request-id'] as string) || '',
      event: 'round_approved',
      ipAddress: clientIp,
      metadata: {
        roundId: approvedRound.id,
        playerId: approvedRound.player_id,
        teeConfigurationId: approvedRound.tee_configuration_id,
        playedAt: approvedRound.played_at,
        actorUserId: authResult.auth.userId,
      },
    });

    const handicapRecalculation = await maybeRecalculateHandicapForPlayer(
      approvedRound.player_id,
      true,
      'manual_round_approval',
    );

    const roundDetailsResult = await dbPool.query(
      `SELECT r.gross_score, r.adjusted_gross_score, c.name
       FROM rounds r
       INNER JOIN tee_configurations tc ON tc.id = r.tee_configuration_id
       INNER JOIN courses c ON c.id = tc.course_id
       WHERE r.id = $1`,
      [approvedRound.id],
    );
    const roundDetails = Number(roundDetailsResult.rowCount || 0) > 0 ? roundDetailsResult.rows[0] : null;

    if (roundDetails) {
      await sendRoundNotification({
        playerId: approvedRound.player_id,
        roundId: approvedRound.id,
        eventType: 'round_approved',
        status: 'approved',
        grossScore: Number(roundDetails.gross_score),
        adjustedGrossScore: Number(roundDetails.adjusted_gross_score),
        courseName: String(roundDetails.name),
        playedAt: approvedRound.played_at,
      });
    }

    await logApplicationEvent({
      requestId: (req.headers['x-request-id'] as string) || '',
      event: 'handicap_recalculation_requested',
      ipAddress: clientIp,
      metadata: {
        reason: 'round_approved',
        roundId: approvedRound.id,
        playerId: approvedRound.player_id,
        actorUserId: authResult.auth.userId,
        scoreDifferential: approvedRound.score_differential === null ? null : Number(approvedRound.score_differential),
        recalculationStatus: handicapRecalculation.status,
      },
    });

    sendJson(res, 200, {
      message: 'Round approved',
      round: {
        id: approvedRound.id,
        playerId: approvedRound.player_id,
        teeConfigurationId: approvedRound.tee_configuration_id,
        playedAt: approvedRound.played_at,
        status: approvedRound.status,
        rejectionReason: approvedRound.rejection_reason,
      },
      handicapRecalculationRequested: true,
      handicapRecalculation,
    });
  } catch (error) {
    console.error('[rounds.approve] unexpected error:', error);
    sendError(res, 500, 'round_approval_failed', 'Unable to approve round at this time');
  }
}

export async function handleRejectRound(req: http.IncomingMessage, res: http.ServerResponse, roundId: string): Promise<void> {
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

  const rejectionReason = typeof payload.rejectionReason === 'string'
    ? payload.rejectionReason.trim()
    : typeof payload.reason === 'string'
      ? payload.reason.trim()
      : '';

  if (!rejectionReason) {
    sendError(res, 400, 'validation_error', 'rejectionReason is required', [{ field: 'rejectionReason', message: 'rejectionReason is required' }]);
    return;
  }

  const clientIp = getClientIp(req);

  try {
    const result = await dbPool.query(
      `UPDATE rounds
       SET status = 'rejected', rejection_reason = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, player_id, tee_configuration_id, played_at, status, rejection_reason, score_differential`,
      [roundId, rejectionReason],
    );

    if (Number(result.rowCount || 0) === 0) {
      sendError(res, 404, 'not_found', 'Round not found');
      return;
    }

    const rejectedRound = result.rows[0] as {
      id: string;
      player_id: string;
      tee_configuration_id: string;
      played_at: string;
      status: RoundStatus;
      rejection_reason: string | null;
      score_differential: number | null;
    };

    await logApplicationEvent({
      requestId: (req.headers['x-request-id'] as string) || '',
      event: 'round_rejected',
      ipAddress: clientIp,
      metadata: {
        roundId: rejectedRound.id,
        playerId: rejectedRound.player_id,
        teeConfigurationId: rejectedRound.tee_configuration_id,
        playedAt: rejectedRound.played_at,
        reason: rejectedRound.rejection_reason,
        actorUserId: authResult.auth.userId,
      },
    });

    const shouldRequestHandicapRecalculation = rejectedRound.score_differential !== null;
    if (shouldRequestHandicapRecalculation) {
      await logApplicationEvent({
        requestId: (req.headers['x-request-id'] as string) || '',
        event: 'handicap_recalculation_requested',
        ipAddress: clientIp,
        metadata: {
          reason: 'round_rejected',
          roundId: rejectedRound.id,
          playerId: rejectedRound.player_id,
          actorUserId: authResult.auth.userId,
          scoreDifferential: Number(rejectedRound.score_differential),
        },
      });
    }

    sendJson(res, 200, {
      message: 'Round rejected',
      round: {
        id: rejectedRound.id,
        playerId: rejectedRound.player_id,
        teeConfigurationId: rejectedRound.tee_configuration_id,
        playedAt: rejectedRound.played_at,
        status: rejectedRound.status,
        rejectionReason: rejectedRound.rejection_reason,
      },
      handicapRecalculationRequested: shouldRequestHandicapRecalculation,
    });
  } catch (error) {
    console.error('[rounds.reject] unexpected error:', error);
    sendError(res, 500, 'round_rejection_failed', 'Unable to reject round at this time');
  }
}

interface RoundImportRowValues {
  player_name: string;
  course_name: string;
  tee_colour: string;
  played_at: string;
  hole_strokes: number[];
}

interface RoundImportRowResult {
  rowNumber: number;
  values: RoundImportRowValues;
  issues: ValidationIssue[];
  lookupWarnings: string[];
}

function parseCsvTextForRounds(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentCell = '';
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }
      currentRow.push(currentCell.trim());
      currentCell = '';
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function normalizeHeaderForRounds(header: string): string {
  return header.trim().toLowerCase();
}

async function parseRoundImportRows(csvText: string): Promise<{ headers: string[]; rows: RoundImportRowResult[] }> {
  const parsedRows = parseCsvTextForRounds(csvText);
  if (parsedRows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parsedRows[0].map(normalizeHeaderForRounds);
  const results: RoundImportRowResult[] = [];

  for (let rowIndex = 1; rowIndex < parsedRows.length; rowIndex += 1) {
    const row = parsedRows[rowIndex];
    const record = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])) as Record<string, string>;
    const issues: ValidationIssue[] = [];
    const lookupWarnings: string[] = [];

    const playerName = record.player_name?.trim() || '';
    const courseName = record.course_name?.trim() || '';
    const teeColour = record.tee_colour?.trim() || '';
    const playedAt = record.played_at?.trim() || '';

    if (!playerName) {
      issues.push({ field: 'player_name', message: 'Player name is required' });
    }

    if (!courseName) {
      issues.push({ field: 'course_name', message: 'Course name is required' });
    }

    if (!teeColour) {
      issues.push({ field: 'tee_colour', message: 'Tee colour is required' });
    }

    if (!playedAt) {
      issues.push({ field: 'played_at', message: 'Played at date is required' });
    } else {
      const parsed = new Date(playedAt);
      if (Number.isNaN(parsed.getTime())) {
        issues.push({ field: 'played_at', message: 'Played at must be a valid date (YYYY-MM-DD or ISO format)' });
      }
    }

    // Parse hole strokes
    const holeStrokes: number[] = [];
    for (let holeNum = 1; holeNum <= 18; holeNum += 1) {
      const strokeKey = `h${holeNum}_strokes`;
      const strokeStr = record[strokeKey]?.trim() || '';
      if (!strokeStr) {
        issues.push({ field: strokeKey, message: `Hole ${holeNum} strokes are required` });
        holeStrokes.push(0);
      } else {
        const strokes = Number(strokeStr);
        if (!Number.isInteger(strokes) || strokes < 1) {
          issues.push({ field: strokeKey, message: `Hole ${holeNum} strokes must be an integer >= 1` });
        }
        holeStrokes.push(strokes);
      }
    }

    results.push({
      rowNumber: rowIndex + 1,
      values: {
        player_name: playerName,
        course_name: courseName,
        tee_colour: teeColour,
        played_at: playedAt,
        hole_strokes: holeStrokes,
      },
      issues,
      lookupWarnings,
    });
  }

  return { headers, rows: results };
}

export async function handleImportRounds(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

  const csvText = typeof payload.csvText === 'string' ? payload.csvText.trim() : '';
  const dryRun = payload.dryRun !== false;

  if (!csvText) {
    sendError(res, 400, 'validation_error', 'csvText is required');
    return;
  }

  const { headers, rows } = await parseRoundImportRows(csvText);
  if (headers.length === 0 || rows.length === 0) {
    sendError(res, 400, 'validation_error', 'CSV must include a header row and at least one data row');
    return;
  }

  const totalIssues = rows.reduce((sum, row) => sum + row.issues.length, 0);

  if (dryRun) {
    sendJson(res, 200, {
      dryRun: true,
      summary: {
        rowCount: rows.length,
        validRows: rows.filter((row) => row.issues.length === 0).length,
        invalidRows: rows.filter((row) => row.issues.length > 0).length,
        totalIssues,
      },
      rows,
    });
    return;
  }

  if (totalIssues > 0) {
    sendJson(res, 400, {
      error: {
        code: 'validation_error',
        message: 'Import contains validation errors',
      },
      dryRun: false,
      summary: {
        rowCount: rows.length,
        validRows: rows.filter((row) => row.issues.length === 0).length,
        invalidRows: rows.filter((row) => row.issues.length > 0).length,
        totalIssues,
      },
      rows,
    });
    return;
  }

  const LARGE_IMPORT_THRESHOLD = 100;
  if (rows.length > LARGE_IMPORT_THRESHOLD) {
    const userResult = await dbPool.query<{ email: string }>(
      `SELECT email::text AS email FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [authResult.auth.userId],
    );
    const adminEmail = String((userResult.rows[0] as { email: string } | undefined)?.email ?? '');
    const job = createImportJob({
      type: 'rounds',
      totalRows: rows.length,
      adminUserId: authResult.auth.userId,
      adminEmail,
    });

    sendJson(res, 202, {
      queued: true,
      jobId: job.jobId,
      rowCount: rows.length,
      adminEmail,
      message: `Large import queued (${rows.length} rows). An email will be sent to ${adminEmail} when complete.`,
    });

    setImmediate(async () => {
      job.status = 'in_progress';
      const bgClient = await dbPool.connect();
      try {
        await bgClient.query('BEGIN');
        const importedRounds: string[] = [];

        for (const row of rows) {
          if (row.issues.length > 0) {
            job.processedRows += 1;
            job.failedRows += 1;
            continue;
          }
          try {
            const playerNameParts = row.values.player_name.trim().split(/\s+/);
            let playerResult;
            if (playerNameParts.length >= 2) {
              playerResult = await bgClient.query(
                'SELECT id FROM players WHERE first_name ILIKE $1 AND last_name ILIKE $2 AND deleted_at IS NULL LIMIT 1',
                [playerNameParts[0], playerNameParts[playerNameParts.length - 1]],
              );
            } else {
              playerResult = await bgClient.query(
                'SELECT id FROM players WHERE (first_name ILIKE $1 OR last_name ILIKE $1) AND deleted_at IS NULL LIMIT 1',
                [playerNameParts[0]],
              );
            }
            if (!playerResult || playerResult.rows.length === 0) {
              job.processedRows += 1;
              job.failedRows += 1;
              job.errors.push(`Row ${job.processedRows}: player '${row.values.player_name}' not found`);
              continue;
            }
            const playerId = playerResult.rows[0].id;

            const courseResult = await bgClient.query(
              'SELECT id FROM courses WHERE name ILIKE $1 AND deleted_at IS NULL LIMIT 1',
              [row.values.course_name],
            );
            if (!courseResult || courseResult.rows.length === 0) {
              job.processedRows += 1;
              job.failedRows += 1;
              job.errors.push(`Row ${job.processedRows}: course '${row.values.course_name}' not found`);
              continue;
            }
            const courseId = courseResult.rows[0].id;

            const teeResult = await bgClient.query(
              'SELECT id FROM tee_configurations WHERE course_id = $1 AND tee_colour ILIKE $2 AND deleted_at IS NULL LIMIT 1',
              [courseId, row.values.tee_colour],
            );
            if (!teeResult || teeResult.rows.length === 0) {
              job.processedRows += 1;
              job.failedRows += 1;
              job.errors.push(`Row ${job.processedRows}: tee '${row.values.tee_colour}' not found for course`);
              continue;
            }
            const teeConfigurationId = teeResult.rows[0].id;

            const roundResult = await bgClient.query(
              `INSERT INTO rounds (player_id, tee_configuration_id, played_at, status)
               VALUES ($1, $2, $3, 'pending')
               RETURNING id`,
              [playerId, teeConfigurationId, row.values.played_at],
            );
            const roundId = String(roundResult.rows[0].id);

            for (let holeNum = 1; holeNum <= 18; holeNum += 1) {
              const strokes = row.values.hole_strokes[holeNum - 1];
              await bgClient.query(
                `INSERT INTO hole_scores (round_id, hole_number, strokes) VALUES ($1, $2, $3)`,
                [roundId, holeNum, strokes],
              );
            }

            importedRounds.push(roundId);
            job.processedRows += 1;
            job.importedRows += 1;
          } catch (rowErr) {
            job.processedRows += 1;
            job.failedRows += 1;
            job.errors.push(`Row ${job.processedRows}: ${(rowErr as Error).message}`);
          }
        }

        await bgClient.query('COMMIT');
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        await sendEmail(
          adminEmail,
          `Round import complete – ${job.importedRows} of ${job.totalRows} rows imported`,
          {
            text: `Your round CSV import has completed.\n\nImported: ${job.importedRows} of ${job.totalRows} rows\nFailed: ${job.failedRows} rows${job.errors.length > 0 ? '\n\nErrors (first 10):\n' + job.errors.slice(0, 10).join('\n') : ''}`,
            html: `<p>Your round CSV import has completed.</p><ul><li><strong>Imported:</strong> ${job.importedRows} of ${job.totalRows} rows</li><li><strong>Failed:</strong> ${job.failedRows} rows</li></ul>${job.errors.length > 0 ? '<p><strong>Errors (first 10):</strong></p><ul>' + job.errors.slice(0, 10).map((e) => `<li>${e}</li>`).join('') + '</ul>' : ''}`,
          },
        ).catch((emailErr: Error) => {
          console.error('[rounds.import.bg] completion email failed:', emailErr.message);
        });
      } catch (bgErr) {
        await bgClient.query('ROLLBACK').catch(() => {});
        job.status = 'failed';
        job.completedAt = new Date().toISOString();
        job.errors.push((bgErr as Error).message);
        await sendEmail(
          adminEmail,
          'Round import failed',
          {
            text: `Your round CSV import failed.\n\nError: ${(bgErr as Error).message}`,
            html: `<p>Your round CSV import failed.</p><p><strong>Error:</strong> ${(bgErr as Error).message}</p>`,
          },
        ).catch(() => {});
        console.error('[rounds.import.bg] background job failed:', bgErr);
      } finally {
        bgClient.release();
      }
    });
    return;
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');

    const importedRounds = [];

    for (const row of rows) {
      if (row.issues.length > 0) {
        continue;
      }

      const playerNameParts = row.values.player_name.trim().split(/\s+/);
      let playerResult;

      if (playerNameParts.length >= 2) {
        playerResult = await client.query(
          'SELECT id FROM players WHERE first_name ILIKE $1 AND last_name ILIKE $2 AND deleted_at IS NULL LIMIT 1',
          [playerNameParts[0], playerNameParts[playerNameParts.length - 1]],
        );
      } else if (playerNameParts.length === 1) {
        playerResult = await client.query(
          'SELECT id FROM players WHERE (first_name ILIKE $1 OR last_name ILIKE $1) AND deleted_at IS NULL LIMIT 1',
          [playerNameParts[0]],
        );
      }

      if (!playerResult || playerResult.rows.length === 0) {
        continue;
      }

      const playerId = playerResult.rows[0].id;

      const courseResult = await client.query(
        'SELECT id FROM courses WHERE name ILIKE $1 AND deleted_at IS NULL LIMIT 1',
        [row.values.course_name],
      );

      if (!courseResult || courseResult.rows.length === 0) {
        continue;
      }

      const courseId = courseResult.rows[0].id;

      const teeResult = await client.query(
        'SELECT id FROM tee_configurations WHERE course_id = $1 AND tee_colour ILIKE $2 AND deleted_at IS NULL LIMIT 1',
        [courseId, row.values.tee_colour],
      );

      if (!teeResult || teeResult.rows.length === 0) {
        continue;
      }

      const teeConfigurationId = teeResult.rows[0].id;

      const roundResult = await client.query(
        `INSERT INTO rounds (player_id, tee_configuration_id, played_at, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING id`,
        [playerId, teeConfigurationId, row.values.played_at],
      );

      const roundId = roundResult.rows[0].id;

      for (let holeNum = 1; holeNum <= 18; holeNum += 1) {
        const strokes = row.values.hole_strokes[holeNum - 1];
        await client.query(
          `INSERT INTO hole_scores (round_id, hole_number, strokes)
           VALUES ($1, $2, $3)`,
          [roundId, holeNum, strokes],
        );
      }

      importedRounds.push(roundId);
    }

    await client.query('COMMIT');

    sendJson(res, 201, {
      dryRun: false,
      summary: {
        rowCount: rows.length,
        importedRows: importedRounds.length,
      },
      importedRoundIds: importedRounds,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[rounds.import] unexpected error:', error);
    sendError(res, 500, 'round_import_failed', 'Unable to import rounds at this time');
  } finally {
    client.release();
  }
}
