CREATE INDEX IF NOT EXISTS idx_rounds_player_non_deleted_played_at
  ON rounds(player_id, played_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rounds_pending_non_deleted
  ON rounds(status, played_at DESC)
  WHERE deleted_at IS NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_rounds_approved_non_deleted
  ON rounds(player_id, status, played_at DESC)
  WHERE deleted_at IS NULL AND status = 'approved';

CREATE INDEX IF NOT EXISTS idx_players_active_handicap
  ON players(handicap_index)
  WHERE deleted_at IS NULL AND handicap_index IS NOT NULL;
