ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS theme_mode TEXT NOT NULL DEFAULT 'system';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notification_preferences_theme_mode_check'
      AND conrelid = 'notification_preferences'::regclass
  ) THEN
    ALTER TABLE notification_preferences
      ADD CONSTRAINT notification_preferences_theme_mode_check
      CHECK (theme_mode IN ('light', 'dark', 'system'));
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS feedback_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  screenshot_data_url TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT feedback_reports_category_check CHECK (category IN ('bug', 'feature', 'ui', 'other')),
  CONSTRAINT feedback_reports_status_check CHECK (status IN ('open', 'reviewed', 'resolved')),
  CONSTRAINT feedback_reports_message_length_check CHECK (char_length(trim(message)) >= 5)
);

CREATE INDEX IF NOT EXISTS idx_feedback_reports_created_at ON feedback_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_user_id ON feedback_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reports_status ON feedback_reports(status);
