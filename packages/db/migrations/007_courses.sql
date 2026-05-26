-- Create courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country CHAR(2),
  phone TEXT,
  email TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Unique constraint on name per country (only for active records)
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_name_country_unique
  ON courses (LOWER(name), country)
  WHERE deleted_at IS NULL;

-- Indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_courses_city ON courses(city) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_courses_country ON courses(country) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_courses_deleted_at ON courses(deleted_at);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at DESC);
