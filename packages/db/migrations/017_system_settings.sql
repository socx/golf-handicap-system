CREATE TABLE IF NOT EXISTS system_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  pcc_override SMALLINT NULL,
  notification_settings JSONB NOT NULL DEFAULT '{"round_submitted": true, "round_approved": true, "maintenance_alerts": true}'::jsonb,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT system_settings_singleton_chk CHECK (id = 1),
  CONSTRAINT system_settings_pcc_override_chk CHECK (pcc_override IS NULL OR (pcc_override BETWEEN -1 AND 3)),
  CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO system_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
