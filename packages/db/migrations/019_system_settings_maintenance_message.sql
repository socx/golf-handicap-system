ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS maintenance_message TEXT NOT NULL DEFAULT 'Scheduled maintenance is in progress. Some features may be temporarily unavailable.';
