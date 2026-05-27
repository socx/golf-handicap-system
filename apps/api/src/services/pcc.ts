import type { PoolClient } from 'pg';

export type DailyPccSource = 'calculated' | 'override';

export interface DailyPccRecord {
  teeConfigurationId: string;
  playedOn: string;
  pcc: number;
  source: DailyPccSource;
}

function normalizePlayedOn(playedAt: string): string {
  const date = new Date(playedAt);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid playedAt value');
  }

  return date.toISOString().slice(0, 10);
}

function clampPcc(value: number): number {
  return Math.max(-1, Math.min(3, Math.trunc(value)));
}

function derivePccFromRounds(rows: Array<{ adjusted_gross_score: number; course_rating: number; slope_rating: number }>): number {
  if (rows.length === 0) {
    return 0;
  }

  const averageDifferential = rows.reduce((sum, row) => {
    return sum + ((113 / row.slope_rating) * (row.adjusted_gross_score - row.course_rating));
  }, 0) / rows.length;

  if (averageDifferential <= -1) {
    return -1;
  }

  if (averageDifferential < 0.5) {
    return 0;
  }

  if (averageDifferential < 1.5) {
    return 1;
  }

  if (averageDifferential < 2.5) {
    return 2;
  }

  return 3;
}

export function getPlayedOnDate(playedAt: string): string {
  return normalizePlayedOn(playedAt);
}

export async function getOrCreateDailyPcc(
  client: PoolClient,
  teeConfigurationId: string,
  playedOn: string,
): Promise<DailyPccRecord> {
  const existing = await client.query(
    `SELECT tee_configuration_id, played_on, pcc, source
     FROM tee_configuration_daily_pcc
     WHERE tee_configuration_id = $1 AND played_on = $2::date
     LIMIT 1`,
    [teeConfigurationId, playedOn],
  );

  if (Number(existing.rowCount || 0) > 0) {
    const row = existing.rows[0] as { tee_configuration_id: string; played_on: string; pcc: number; source: DailyPccSource };
    return {
      teeConfigurationId: row.tee_configuration_id,
      playedOn: String(row.played_on).slice(0, 10),
      pcc: Number(row.pcc),
      source: row.source,
    };
  }

  await client.query(
    `INSERT INTO tee_configuration_daily_pcc (tee_configuration_id, played_on, pcc, source)
     VALUES ($1, $2::date, $3, 'calculated')`,
    [teeConfigurationId, playedOn, 0],
  );

  return {
    teeConfigurationId,
    playedOn,
    pcc: 0,
    source: 'calculated',
  };
}

export async function calculateDailyPcc(
  client: PoolClient,
  teeConfigurationId: string,
  playedOn: string,
): Promise<number> {
  const result = await client.query(
    `SELECT r.adjusted_gross_score, tc.course_rating, tc.slope_rating
     FROM rounds r
     INNER JOIN tee_configurations tc ON tc.id = r.tee_configuration_id
     WHERE r.tee_configuration_id = $1
       AND r.deleted_at IS NULL
       AND r.played_at::date = $2::date
       AND r.adjusted_gross_score IS NOT NULL
       AND tc.course_rating IS NOT NULL
       AND tc.slope_rating IS NOT NULL
       AND tc.slope_rating > 0`,
    [teeConfigurationId, playedOn],
  );

  return derivePccFromRounds(
    result.rows.map((row) => ({
      adjusted_gross_score: Number(row.adjusted_gross_score),
      course_rating: Number(row.course_rating),
      slope_rating: Number(row.slope_rating),
    })),
  );
}

export async function upsertDailyPcc(
  client: PoolClient,
  teeConfigurationId: string,
  playedOn: string,
  pcc: number,
  source: DailyPccSource,
): Promise<DailyPccRecord> {
  const normalizedPcc = clampPcc(pcc);
  await client.query(
    `INSERT INTO tee_configuration_daily_pcc (tee_configuration_id, played_on, pcc, source, updated_at)
     VALUES ($1, $2::date, $3, $4, NOW())
     ON CONFLICT (tee_configuration_id, played_on)
     DO UPDATE SET pcc = EXCLUDED.pcc, source = EXCLUDED.source, updated_at = NOW()`,
    [teeConfigurationId, playedOn, normalizedPcc, source],
  );

  return {
    teeConfigurationId,
    playedOn,
    pcc: normalizedPcc,
    source,
  };
}

export async function applyDailyPccToRounds(
  client: PoolClient,
  teeConfigurationId: string,
  playedOn: string,
  pcc: number,
): Promise<number> {
  const normalizedPcc = clampPcc(pcc);
  const updateResult = await client.query(
    `UPDATE rounds r
     SET pcc = $3::smallint,
         score_differential = CASE
           WHEN tc.course_rating IS NULL OR tc.slope_rating IS NULL OR tc.slope_rating <= 0 THEN NULL
           ELSE ROUND(((113::numeric / tc.slope_rating::numeric) * (r.adjusted_gross_score - tc.course_rating - $4::numeric)), 3)
         END,
         updated_at = NOW()
     FROM tee_configurations tc
     WHERE r.tee_configuration_id = tc.id
       AND r.tee_configuration_id = $1
       AND r.deleted_at IS NULL
       AND r.played_at::date = $2::date`,
    [teeConfigurationId, playedOn, normalizedPcc, normalizedPcc],
  );

  return Number(updateResult.rowCount || 0);
}