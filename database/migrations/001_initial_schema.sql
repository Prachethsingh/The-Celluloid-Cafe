-- ==============================================================================
-- UNIFIED MOVIE & SERIES PLATFORM — DATABASE SCHEMA MIGRATION 001
-- Tables, Primary Keys, Foreign Keys, Constraints, Indexes & Triggers
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Users Table (Authentication, RBAC & Security)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    role VARCHAR(30) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    failed_login_attempts INT DEFAULT 0,
    lockout_until TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. Streaming Ecosystem / Platforms Table
CREATE TABLE IF NOT EXISTS platforms (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    icon_url TEXT,
    primary_color VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Genres Table
CREATE TABLE IF NOT EXISTS genres (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) UNIQUE NOT NULL
);

-- 5. Media Items Table (Movies and Series)
CREATE TABLE IF NOT EXISTS media_items (
    id VARCHAR(100) PRIMARY KEY,
    imdb_id VARCHAR(30),
    tmdb_id INT,
    title VARCHAR(300) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('movie', 'series', 'anime')),
    year INT,
    rating NUMERIC(3, 1) DEFAULT 0.0,
    vote_count INT DEFAULT 0,
    popularity NUMERIC(8, 2) DEFAULT 0.0,
    duration_minutes INT,
    total_seasons INT DEFAULT 0,
    total_episodes INT DEFAULT 0,
    overview TEXT,
    poster_url TEXT,
    backdrop_url TEXT,
    stream_url TEXT,
    is_featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_type ON media_items(type);
CREATE INDEX IF NOT EXISTS idx_media_rating ON media_items(rating DESC);
CREATE INDEX IF NOT EXISTS idx_media_year ON media_items(year DESC);
CREATE INDEX IF NOT EXISTS idx_media_imdb ON media_items(imdb_id);
CREATE INDEX IF NOT EXISTS idx_media_title_trgm ON media_items USING gin (title gin_trgm_ops);

-- 6. Media Genres Junction Table
CREATE TABLE IF NOT EXISTS media_genres (
    media_id VARCHAR(100) REFERENCES media_items(id) ON DELETE CASCADE,
    genre_id VARCHAR(50) REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (media_id, genre_id)
);

-- 7. TV Series Seasons Table
CREATE TABLE IF NOT EXISTS seasons (
    id VARCHAR(120) PRIMARY KEY,
    media_id VARCHAR(100) REFERENCES media_items(id) ON DELETE CASCADE,
    season_number INT NOT NULL,
    title VARCHAR(200),
    episode_count INT DEFAULT 0,
    overview TEXT,
    poster_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (media_id, season_number)
);

-- 8. TV Series Episodes Table
CREATE TABLE IF NOT EXISTS episodes (
    id VARCHAR(150) PRIMARY KEY,
    season_id VARCHAR(120) REFERENCES seasons(id) ON DELETE CASCADE,
    media_id VARCHAR(100) REFERENCES media_items(id) ON DELETE CASCADE,
    episode_number INT NOT NULL,
    season_number INT NOT NULL,
    title VARCHAR(300) NOT NULL,
    overview TEXT,
    duration_minutes INT,
    thumbnail_url TEXT,
    stream_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (media_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episodes_media_season ON episodes(media_id, season_number);

-- 9. Platform Availability Table (Multi-Regional Deep Links)
CREATE TABLE IF NOT EXISTS platform_availabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    media_id VARCHAR(100) REFERENCES media_items(id) ON DELETE CASCADE,
    platform_id VARCHAR(50) REFERENCES platforms(id) ON DELETE CASCADE,
    country_code VARCHAR(5) NOT NULL DEFAULT 'US',
    access_model VARCHAR(30) NOT NULL CHECK (access_model IN ('flatrate', 'free', 'ads', 'rent', 'buy')),
    deep_link TEXT,
    quality VARCHAR(20) DEFAULT '1080p',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (media_id, platform_id, country_code, access_model)
);

CREATE INDEX IF NOT EXISTS idx_avail_country_platform ON platform_availabilities(country_code, platform_id);

-- 10. User Watchlists Table
CREATE TABLE IF NOT EXISTS watchlists (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    media_id VARCHAR(100) REFERENCES media_items(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, media_id)
);

-- 11. Playback History & Continue Watching
CREATE TABLE IF NOT EXISTS playback_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    media_id VARCHAR(100) REFERENCES media_items(id) ON DELETE CASCADE,
    episode_id VARCHAR(150) REFERENCES episodes(id) ON DELETE SET NULL,
    progress_seconds INT DEFAULT 0,
    duration_seconds INT DEFAULT 0,
    completion_percentage NUMERIC(5, 2) DEFAULT 0.0,
    last_played_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_history_user ON playback_history(user_id, last_played_at DESC);

-- 12. Playback Sessions (Signed & Authorized, Anti-Redirect, Anti-Ad)
CREATE TABLE IF NOT EXISTS playback_sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    media_id VARCHAR(100) REFERENCES media_items(id) ON DELETE CASCADE,
    episode_id VARCHAR(150) REFERENCES episodes(id) ON DELETE SET NULL,
    client_ip VARCHAR(50),
    user_agent TEXT,
    stream_engine VARCHAR(50) DEFAULT 'vega-autoembed',
    stream_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON playback_sessions(expires_at);

-- 13. Vega Providers Registry & Health State
CREATE TABLE IF NOT EXISTS vega_provider_nodes (
    id VARCHAR(60) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL DEFAULT 'global',
    version VARCHAR(20) DEFAULT '1.0',
    icon_url TEXT,
    mirror_url TEXT,
    is_enabled BOOLEAN DEFAULT TRUE,
    latency_ms INT DEFAULT 30,
    last_health_check TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
