import { dbPool } from '../lib/db';

interface PerformanceMetricRow {
  total_holes: string;
  gir_holes: string;
  fir_opportunities: string;
  fir_hits: string;
  total_putts: string;
  total_penalties: string;
  rounds_played: string;
}

interface ScoringAverageRow {
  front9_average: string | null;
  back9_average: string | null;
  overall_average: string | null;
}

interface HandicapTrendRow {
  id: string;
  calculation_date: string;
  handicap_index: string;
  rounds_used: unknown;
}

interface RecentRoundRow {
  id: string;
  played_at: string;
  gross_score: number;
  adjusted_gross_score: number;
  status: 'pending' | 'approved' | 'rejected';
  course_name: string | null;
}

interface AdminOverviewRow {
  total_players: string;
  total_rounds: string;
  pending_rounds: string;
  average_handicap_index: string | null;
}

interface DistributionRow {
  bucket: string;
  count: string;
}

interface RecentActivityRow {
  id: string;
  event_type: string;
  actor_user_id: string | null;
  user_id: string | null;
  ip_address: string;
  metadata: unknown;
  created_at: string;
}

export interface PlayerPerformanceMetrics {
  girPercentage: number;
  firPercentage: number;
  averagePutts: number;
  averagePenalties: number;
}

export interface ScoringAverages {
  front9: number | null;
  back9: number | null;
  overall: number | null;
}

export interface HandicapTrendPoint {
  id: string;
  calculationDate: string;
  handicapIndex: number;
  roundsUsed: string[];
}

export interface RecentRoundSummary {
  id: string;
  playedAt: string;
  courseName: string | null;
  grossScore: number;
  adjustedGrossScore: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AdminOverviewMetrics {
  totalPlayers: number;
  totalRounds: number;
  pendingRounds: number;
  averageHandicapIndex: number | null;
}

export interface HandicapDistributionBucket {
  range: string;
  count: number;
}

export interface RecentActivityEntry {
  id: string;
  eventType: string;
  actorUserId: string | null;
  userId: string | null;
  ipAddress: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value;
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toOptionalNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMetric(value: number, decimals = 1): number {
  return Number(value.toFixed(decimals));
}

export function computePercentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return roundMetric((numerator / denominator) * 100, 1);
}

export function computeAverage(total: number, count: number): number {
  if (count <= 0) return 0;
  return roundMetric(total / count, 2);
}

export function buildPerformanceMetrics(row: PerformanceMetricRow | null | undefined): PlayerPerformanceMetrics {
  if (!row) {
    return {
      girPercentage: 0,
      firPercentage: 0,
      averagePutts: 0,
      averagePenalties: 0,
    };
  }

  const totalHoles = toNumber(row.total_holes);
  const girHoles = toNumber(row.gir_holes);
  const firOpportunities = toNumber(row.fir_opportunities);
  const firHits = toNumber(row.fir_hits);
  const totalPutts = toNumber(row.total_putts);
  const totalPenalties = toNumber(row.total_penalties);
  const roundsPlayed = toNumber(row.rounds_played);

  return {
    girPercentage: computePercentage(girHoles, totalHoles),
    firPercentage: computePercentage(firHits, firOpportunities),
    averagePutts: computeAverage(totalPutts, roundsPlayed),
    averagePenalties: computeAverage(totalPenalties, roundsPlayed),
  };
}

export function buildScoringAverages(row: ScoringAverageRow | null | undefined): ScoringAverages {
  if (!row) {
    return { front9: null, back9: null, overall: null };
  }

  return {
    front9: toOptionalNumber(row.front9_average),
    back9: toOptionalNumber(row.back9_average),
    overall: toOptionalNumber(row.overall_average),
  };
}

export async function getPlayerPerformanceMetrics(playerId: string): Promise<PlayerPerformanceMetrics> {
  const result = await dbPool.query<PerformanceMetricRow>(
    `SELECT
       COUNT(hs.id)::int AS total_holes,
       COALESCE(SUM(CASE WHEN hs.gir THEN 1 ELSE 0 END), 0)::int AS gir_holes,
       COALESCE(SUM(CASE WHEN hs.fairway_hit IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS fir_opportunities,
       COALESCE(SUM(CASE WHEN hs.fairway_hit = TRUE THEN 1 ELSE 0 END), 0)::int AS fir_hits,
       COALESCE(SUM(r.total_putts), 0)::int AS total_putts,
       COALESCE(SUM(r.total_penalties), 0)::int AS total_penalties,
       COUNT(DISTINCT r.id)::int AS rounds_played
     FROM rounds r
     INNER JOIN hole_scores hs ON hs.round_id = r.id
     WHERE r.player_id = $1
       AND r.deleted_at IS NULL
       AND r.status = 'approved'`,
    [playerId],
  );

  return buildPerformanceMetrics(result.rows[0]);
}

export async function getPlayerScoringAverages(playerId: string): Promise<ScoringAverages> {
  const result = await dbPool.query<ScoringAverageRow>(
    `SELECT
       ROUND(AVG(CASE WHEN hs.hole_number BETWEEN 1 AND 9 THEN hs.strokes END)::numeric, 2) AS front9_average,
       ROUND(AVG(CASE WHEN hs.hole_number BETWEEN 10 AND 18 THEN hs.strokes END)::numeric, 2) AS back9_average,
       ROUND(AVG(r.gross_score)::numeric, 2) AS overall_average
     FROM rounds r
     LEFT JOIN hole_scores hs ON hs.round_id = r.id
     WHERE r.player_id = $1
       AND r.deleted_at IS NULL
       AND r.status = 'approved'`,
    [playerId],
  );

  return buildScoringAverages(result.rows[0]);
}

export async function getPlayerHandicapTrend(playerId: string, limit = 10): Promise<HandicapTrendPoint[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));

  const result = await dbPool.query<HandicapTrendRow>(
    `SELECT id, calculation_date, handicap_index, rounds_used
     FROM handicap_records
     WHERE player_id = $1
     ORDER BY calculation_date DESC
     LIMIT $2`,
    [playerId, safeLimit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    calculationDate: row.calculation_date,
    handicapIndex: roundMetric(Number(row.handicap_index), 1),
    roundsUsed: Array.isArray(row.rounds_used) ? row.rounds_used.map((value) => String(value)) : [],
  }));
}

export async function getRecentPlayerRounds(playerId: string, limit = 5): Promise<RecentRoundSummary[]> {
  const safeLimit = Math.max(1, Math.min(limit, 20));

  const result = await dbPool.query<RecentRoundRow>(
    `SELECT r.id, r.played_at, r.gross_score, r.adjusted_gross_score, r.status, c.name AS course_name
     FROM rounds r
     LEFT JOIN tee_configurations tc ON tc.id = r.tee_configuration_id
     LEFT JOIN courses c ON c.id = tc.course_id
     WHERE r.player_id = $1
       AND r.deleted_at IS NULL
     ORDER BY r.played_at DESC
     LIMIT $2`,
    [playerId, safeLimit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    playedAt: row.played_at,
    courseName: row.course_name,
    grossScore: Number(row.gross_score || 0),
    adjustedGrossScore: Number(row.adjusted_gross_score || 0),
    status: row.status,
  }));
}

export async function getAdminOverviewMetrics(): Promise<AdminOverviewMetrics> {
  const result = await dbPool.query<AdminOverviewRow>(
    `SELECT
       (SELECT COUNT(*)::int FROM players WHERE deleted_at IS NULL) AS total_players,
       (SELECT COUNT(*)::int FROM rounds WHERE deleted_at IS NULL) AS total_rounds,
       (SELECT COUNT(*)::int FROM rounds WHERE deleted_at IS NULL AND status = 'pending') AS pending_rounds,
       (SELECT ROUND(AVG(handicap_index)::numeric, 1)
          FROM players
         WHERE deleted_at IS NULL
           AND handicap_index IS NOT NULL) AS average_handicap_index`,
  );

  const row = result.rows[0];

  return {
    totalPlayers: toNumber(row?.total_players),
    totalRounds: toNumber(row?.total_rounds),
    pendingRounds: toNumber(row?.pending_rounds),
    averageHandicapIndex: toOptionalNumber(row?.average_handicap_index),
  };
}

export async function getHandicapDistribution(): Promise<HandicapDistributionBucket[]> {
  const result = await dbPool.query<DistributionRow>(
    `SELECT
       CASE
         WHEN handicap_index < 5 THEN '<5'
         WHEN handicap_index < 10 THEN '5-9.9'
         WHEN handicap_index < 15 THEN '10-14.9'
         WHEN handicap_index < 20 THEN '15-19.9'
         WHEN handicap_index < 25 THEN '20-24.9'
         ELSE '25+'
       END AS bucket,
       COUNT(*)::int AS count
     FROM players
     WHERE deleted_at IS NULL
       AND handicap_index IS NOT NULL
     GROUP BY bucket
     ORDER BY MIN(handicap_index)`,
  );

  return result.rows.map((row) => ({
    range: row.bucket,
    count: toNumber(row.count),
  }));
}

export async function getRecentActivity(limit = 20): Promise<RecentActivityEntry[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const result = await dbPool.query<RecentActivityRow>(
    `SELECT id, event_type, actor_user_id, user_id, ip_address, metadata, created_at
     FROM audit_logs
     ORDER BY created_at DESC
     LIMIT $1`,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    actorUserId: row.actor_user_id,
    userId: row.user_id,
    ipAddress: row.ip_address,
    metadata: row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {},
    createdAt: row.created_at,
  }));
}
