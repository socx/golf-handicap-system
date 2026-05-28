ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE rounds
SET status = CASE
  WHEN deleted_at IS NULL AND score_differential IS NOT NULL THEN 'approved'
  ELSE 'pending'
END
WHERE status IS NULL OR status NOT IN ('pending', 'approved', 'rejected');

UPDATE rounds
SET status = 'approved'
WHERE deleted_at IS NULL AND score_differential IS NOT NULL;

ALTER TABLE rounds
  ADD CONSTRAINT rounds_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_rounds_player_approved_played_at
  ON rounds(player_id, played_at DESC)
  WHERE deleted_at IS NULL AND status = 'approved';
