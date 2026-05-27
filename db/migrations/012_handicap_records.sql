CREATE TABLE IF NOT EXISTS handicap_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL,
  calculation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  handicap_index NUMERIC(4,1) NOT NULL,
  num_differentials SMALLINT NOT NULL CHECK (num_differentials BETWEEN 1 AND 8),
  average_differential NUMERIC(6,3) NOT NULL,
  differentials_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  rounds_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  pcc_values JSONB NOT NULL DEFAULT '[]'::jsonb,
  cap_adjustments JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handicap_records_player_date
  ON handicap_records(player_id, calculation_date DESC);

DO $$
BEGIN
  IF to_regclass('public.players') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'handicap_records_player_id_fkey'
     ) THEN
    ALTER TABLE handicap_records
      ADD CONSTRAINT handicap_records_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
  END IF;
END
$$;