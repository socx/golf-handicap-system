CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY,
  handicap_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  round_submitted_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  round_approved_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notification_preferences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO notification_preferences (user_id)
SELECT u.id
FROM users u
LEFT JOIN notification_preferences np ON np.user_id = u.id
WHERE np.user_id IS NULL;

CREATE OR REPLACE FUNCTION ensure_notification_preferences_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_insert_notification_preferences ON users;

CREATE TRIGGER trg_users_insert_notification_preferences
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION ensure_notification_preferences_for_user();
