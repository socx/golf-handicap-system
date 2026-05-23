CREATE TABLE IF NOT EXISTS account_activation_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aat_user_id    ON account_activation_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_aat_token_hash ON account_activation_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_aat_expires_at ON account_activation_tokens(expires_at);
