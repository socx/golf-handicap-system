ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS release_notes_markdown TEXT NOT NULL DEFAULT E'# What\'s New\n\n## Initial Release\n- Dashboard analytics improvements\n- Handicap override tools\n- Maintenance banner support\n';
