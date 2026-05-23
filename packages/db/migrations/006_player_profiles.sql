ALTER TABLE players
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS club TEXT;

ALTER TABLE players
  ALTER COLUMN email DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_email_key'
      AND conrelid = 'players'::regclass
  ) THEN
    ALTER TABLE players DROP CONSTRAINT players_email_key;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_email_unique_active
  ON players (LOWER(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_user_id_unique_active
  ON players (user_id)
  WHERE deleted_at IS NULL AND user_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_gender_check'
      AND conrelid = 'players'::regclass
  ) THEN
    ALTER TABLE players
      ADD CONSTRAINT players_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'prefer_not_to_say'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_players_club ON players(club);
CREATE INDEX IF NOT EXISTS idx_players_country ON players(country);
