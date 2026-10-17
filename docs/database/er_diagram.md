# Database Entity-Relationship (ER) Diagram & Specification

## 1. Mermaid Entity-Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ WATCHLISTS : "has"
    USERS ||--o{ PLAYBACK_HISTORY : "tracks"
    USERS ||--o{ PLAYBACK_SESSIONS : "authenticates"
    
    MEDIA_ITEMS ||--o{ MEDIA_GENRES : "categorized as"
    GENRES ||--o{ MEDIA_GENRES : "groups"
    
    MEDIA_ITEMS ||--o{ SEASONS : "contains"
    SEASONS ||--o{ EPISODES : "has"
    MEDIA_ITEMS ||--o{ EPISODES : "directly links"
    
    MEDIA_ITEMS ||--o{ PLATFORM_AVAILABILITIES : "available on"
    PLATFORMS ||--o{ PLATFORM_AVAILABILITIES : "hosts"
    
    MEDIA_ITEMS ||--o{ WATCHLISTS : "saved in"
    MEDIA_ITEMS ||--o{ PLAYBACK_HISTORY : "logged in"
    MEDIA_ITEMS ||--o{ PLAYBACK_SESSIONS : "streamed via"
    
    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar full_name
        varchar role
        boolean is_active
        boolean is_verified
        int failed_login_attempts
        timestamp lockout_until
        timestamp created_at
    }
    
    MEDIA_ITEMS {
        varchar id PK
        varchar imdb_id
        int tmdb_id
        varchar title
        varchar type
        int year
        numeric rating
        int duration_minutes
        int total_seasons
        int total_episodes
        text overview
        text poster_url
        text backdrop_url
        text stream_url
        boolean is_featured
    }
    
    SEASONS {
        varchar id PK
        varchar media_id FK
        int season_number
        varchar title
        int episode_count
    }
    
    EPISODES {
        varchar id PK
        varchar season_id FK
        varchar media_id FK
        int episode_number
        int season_number
        varchar title
        text thumbnail_url
        text stream_url
    }
    
    PLATFORMS {
        varchar id PK
        varchar name
        text icon_url
        varchar primary_color
    }
    
    PLATFORM_AVAILABILITIES {
        uuid id PK
        varchar media_id FK
        varchar platform_id FK
        varchar country_code
        varchar access_model
        text deep_link
        varchar quality
    }
    
    GENRES {
        varchar id PK
        varchar name UK
        varchar slug UK
    }
    
    MEDIA_GENRES {
        varchar media_id PK, FK
        varchar genre_id PK, FK
    }
    
    WATCHLISTS {
        uuid user_id PK, FK
        varchar media_id PK, FK
        timestamp added_at
    }
    
    PLAYBACK_HISTORY {
        uuid id PK
        uuid user_id FK
        varchar media_id FK
        varchar episode_id FK
        int progress_seconds
        int duration_seconds
        numeric completion_percentage
        timestamp last_played_at
    }
    
    PLAYBACK_SESSIONS {
        varchar id PK
        uuid user_id FK
        varchar media_id FK
        varchar episode_id FK
        varchar stream_engine
        text stream_url
        boolean is_active
        timestamp expires_at
    }
    
    VEGA_PROVIDER_NODES {
        varchar id PK
        varchar name
        varchar category
        varchar version
        text icon_url
        text mirror_url
        boolean is_enabled
        int latency_ms
    }
```

---

## 2. Table Specifications & Constraints

### `users`
- **Primary Key**: `id` (`UUID`)
- **Unique Constraint**: `email` (`VARCHAR(255)`)
- **Checks**: `role IN ('user', 'admin', 'moderator')`
- **Indexes**: `idx_users_email` (B-Tree), `idx_users_role` (B-Tree)

### `media_items`
- **Primary Key**: `id` (`VARCHAR(100)`)
- **Checks**: `type IN ('movie', 'series', 'anime')`
- **Indexes**:
  - `idx_media_type` (B-Tree)
  - `idx_media_rating` (B-Tree, DESC)
  - `idx_media_imdb` (B-Tree)
  - `idx_media_title_trgm` (GIN trigram index for fuzzy matching)

### `platform_availabilities`
- **Primary Key**: `id` (`UUID`)
- **Foreign Keys**: `media_id` -> `media_items.id`, `platform_id` -> `platforms.id`
- **Unique Constraint**: `(media_id, platform_id, country_code, access_model)`
- **Checks**: `access_model IN ('flatrate', 'free', 'ads', 'rent', 'buy')`

---

## 3. Database Maintenance & Backup Strategy

1. **Automated Daily Backups**:
   - `pg_dump -Fc -U postgres movie_platform > /backups/movie_platform_$(date +%Y%m%d).dump`
   - Retention policy: 30 days daily backups, 12 months monthly snapshots.
2. **Connection Pooling**:
   - Managed via PgBouncer or native application pool (default: 5 minimum, 20 maximum).
