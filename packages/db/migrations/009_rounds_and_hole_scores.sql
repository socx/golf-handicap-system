CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL,
  tee_configuration_id UUID NOT NULL,
  played_at TIMESTAMPTZ NOT NULL,
  playing_handicap NUMERIC(5,2),
  gross_score INTEGER CHECK (gross_score IS NULL OR gross_score >= 0),
  adjusted_gross_score INTEGER CHECK (adjusted_gross_score IS NULL OR adjusted_gross_score >= 0),
  score_differential NUMERIC(6,3),
  total_putts INTEGER CHECK (total_putts IS NULL OR total_putts >= 0),
  total_gir INTEGER CHECK (total_gir IS NULL OR total_gir >= 0),
  total_fairways_hit INTEGER CHECK (total_fairways_hit IS NULL OR total_fairways_hit >= 0),
  total_penalties INTEGER CHECK (total_penalties IS NULL OR total_penalties >= 0),
  is_tournament BOOLEAN NOT NULL DEFAULT FALSE,
  is_9_hole BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hole_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes INTEGER NOT NULL CHECK (strokes >= 1),
  putts INTEGER CHECK (putts IS NULL OR putts >= 0),
  gir BOOLEAN NOT NULL DEFAULT FALSE,
  fairway_hit BOOLEAN,
  in_sand BOOLEAN NOT NULL DEFAULT FALSE,
  penalties INTEGER NOT NULL DEFAULT 0 CHECK (penalties >= 0),
  net_double_bogey_adjusted INTEGER NOT NULL DEFAULT 0 CHECK (net_double_bogey_adjusted >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hole_scores_round_hole_unique
  ON hole_scores(round_id, hole_number);

CREATE INDEX IF NOT EXISTS idx_rounds_player_played_at
  ON rounds(player_id, played_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rounds_tee_configuration_id
  ON rounds(tee_configuration_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hole_scores_round_id
  ON hole_scores(round_id);

DO $$
BEGIN
  IF to_regclass('public.players') IS NULL THEN
    RAISE NOTICE 'Skipping FK rounds.player_id -> players(id): players table not found';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rounds_player_id_fkey'
  ) THEN
    ALTER TABLE rounds
      ADD CONSTRAINT rounds_player_id_fkey
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT;
  END IF;

  IF to_regclass('public.tee_configurations') IS NULL THEN
    RAISE NOTICE 'Skipping FK rounds.tee_configuration_id -> tee_configurations(id): tee_configurations table not found';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rounds_tee_configuration_id_fkey'
  ) THEN
    ALTER TABLE rounds
      ADD CONSTRAINT rounds_tee_configuration_id_fkey
      FOREIGN KEY (tee_configuration_id) REFERENCES tee_configurations(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hole_scores_round_id_fkey'
  ) THEN
    ALTER TABLE hole_scores
      ADD CONSTRAINT hole_scores_round_id_fkey
      FOREIGN KEY (round_id) REFERENCES rounds(id) ON DELETE CASCADE;
  END IF;
END
$$;
