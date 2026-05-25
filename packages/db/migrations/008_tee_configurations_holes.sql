-- Create tee_configurations table
CREATE TABLE IF NOT EXISTS tee_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tee_colour TEXT NOT NULL,
  hole_count INTEGER NOT NULL CHECK (hole_count IN (9, 18)),
  course_rating NUMERIC(4, 1),
  slope_rating INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tee_configurations_course_id ON tee_configurations(course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tee_configurations_deleted_at ON tee_configurations(deleted_at);
CREATE INDEX idx_tee_configurations_created_at ON tee_configurations(created_at DESC);

-- Unique constraint on course_id + tee_colour (only for active records)
CREATE UNIQUE INDEX idx_tee_configurations_unique
  ON tee_configurations (course_id, LOWER(tee_colour))
  WHERE deleted_at IS NULL;

-- Create holes table
CREATE TABLE IF NOT EXISTS holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tee_configuration_id UUID NOT NULL REFERENCES tee_configurations(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL,
  distance_yards INTEGER,
  par INTEGER NOT NULL CHECK (par BETWEEN 3 AND 5),
  stroke_index INTEGER NOT NULL CHECK (stroke_index BETWEEN 1 AND 18),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraints per configuration
CREATE UNIQUE INDEX idx_holes_config_number_unique
  ON holes (tee_configuration_id, hole_number);

CREATE UNIQUE INDEX idx_holes_config_stroke_index_unique
  ON holes (tee_configuration_id, stroke_index);

CREATE INDEX idx_holes_tee_config_id ON holes(tee_configuration_id);
