-- Movie Platform — PostgreSQL initialization
-- Enables pg_trgm for fuzzy/trigram search and creates useful indexes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text search index on movie titles
CREATE INDEX IF NOT EXISTS idx_movies_title_trgm ON movies USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_series_title_trgm ON series USING gin (title gin_trgm_ops);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_movies_release_rating ON movies (release_date, rating);
CREATE INDEX IF NOT EXISTS idx_series_air_rating ON series (first_air_date, rating);
CREATE INDEX IF NOT EXISTS idx_availability_content ON availability (content_type, content_id, country_code);
CREATE INDEX IF NOT EXISTS idx_availability_platform_country ON availability (platform_id, country_code);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read, created_at DESC);