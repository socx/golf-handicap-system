CREATE TABLE IF NOT EXISTS handicap_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL,
  admin_user_id UUID NOT NULL,
  previous_index NUMERIC(4,1),
  new_index NUMERIC(4,1) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT handicap_overrides_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT handicap_overrides_admin_user_id_fkey
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_handicap_overrides_player_id
  ON handicap_overrides(player_id, created_at DESC);
