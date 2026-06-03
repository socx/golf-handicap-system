CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT notification_history_status_check
    CHECK (status IN ('sent', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_sent_at
  ON notification_history(user_id, sent_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_notification_history_type
  ON notification_history(type);

CREATE INDEX IF NOT EXISTS idx_notification_history_created_at
  ON notification_history(created_at DESC);
