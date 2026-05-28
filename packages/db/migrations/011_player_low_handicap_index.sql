ALTER TABLE IF EXISTS players
  ADD COLUMN IF NOT EXISTS low_handicap_index NUMERIC(4,1);

CREATE INDEX IF NOT EXISTS idx_players_low_handicap_index
  ON players(low_handicap_index);
