CREATE TABLE IF NOT EXISTS account_activation_tokens (
  id         UUID        PRIMARY KEY DEFAULT (md5(random()::text || clock_timestamp()::text)::uuid),
  user_id    UUID        NOT NULL,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aat_user_id    ON account_activation_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_aat_token_hash ON account_activation_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_aat_expires_at ON account_activation_tokens(expires_at);

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE NOTICE 'Skipping FK account_activation_tokens.user_id -> users(id): users table not found';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_activation_tokens_user_id_fkey'
  ) THEN
    ALTER TABLE account_activation_tokens
      ADD CONSTRAINT account_activation_tokens_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$$;
