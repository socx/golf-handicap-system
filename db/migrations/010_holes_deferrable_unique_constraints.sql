-- 010_holes_deferrable_unique_constraints.sql
-- Convert holes uniqueness from non-deferrable indexes to deferrable constraints
-- so stroke index / hole number swaps can occur safely in a single transaction.

DROP INDEX IF EXISTS idx_holes_config_number_unique;
DROP INDEX IF EXISTS idx_holes_config_stroke_index_unique;

ALTER TABLE holes DROP CONSTRAINT IF EXISTS holes_tee_configuration_hole_number_unique;
ALTER TABLE holes DROP CONSTRAINT IF EXISTS holes_tee_configuration_stroke_index_unique;
ALTER TABLE holes DROP CONSTRAINT IF EXISTS uq_holes_config_number;
ALTER TABLE holes DROP CONSTRAINT IF EXISTS uq_holes_config_stroke_index;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_holes_config_number'
      AND conrelid = 'holes'::regclass
  ) THEN
    ALTER TABLE holes
      ADD CONSTRAINT uq_holes_config_number
      UNIQUE (tee_configuration_id, hole_number)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_holes_config_stroke_index'
      AND conrelid = 'holes'::regclass
  ) THEN
    ALTER TABLE holes
      ADD CONSTRAINT uq_holes_config_stroke_index
      UNIQUE (tee_configuration_id, stroke_index)
      DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;
