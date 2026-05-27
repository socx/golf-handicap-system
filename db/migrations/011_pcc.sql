ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS pcc SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rounds_pcc_check'
  ) THEN
    ALTER TABLE rounds
      ADD CONSTRAINT rounds_pcc_check
      CHECK (pcc IS NULL OR pcc BETWEEN -1 AND 3);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS tee_configuration_daily_pcc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tee_configuration_id UUID NOT NULL,
  played_on DATE NOT NULL,
  pcc SMALLINT NOT NULL CHECK (pcc BETWEEN -1 AND 3),
  source TEXT NOT NULL DEFAULT 'calculated' CHECK (source IN ('calculated', 'override')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tee_configuration_daily_pcc_unique
  ON tee_configuration_daily_pcc(tee_configuration_id, played_on);

DO $$
BEGIN
  IF to_regclass('public.tee_configurations') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'tee_configuration_daily_pcc_tee_configuration_id_fkey'
     ) THEN
    ALTER TABLE tee_configuration_daily_pcc
      ADD CONSTRAINT tee_configuration_daily_pcc_tee_configuration_id_fkey
      FOREIGN KEY (tee_configuration_id) REFERENCES tee_configurations(id) ON DELETE CASCADE;
  END IF;
END
$$;