CREATE EXTENSION IF NOT EXISTS "citext";

ALTER TABLE users
  ALTER COLUMN email TYPE CITEXT USING email::CITEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE users
SET
  password_hash = COALESCE(password_hash, 'PENDING_PASSWORD_RESET'),
  is_active = COALESCE(is_active, TRUE)
WHERE password_hash IS NULL OR is_active IS NULL;

ALTER TABLE users
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT TRUE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
      AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('player', 'admin'));
  END IF;
END $$;
