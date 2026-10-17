-- ==============================================================================
-- UNIFIED MOVIE & SERIES PLATFORM — INITIAL SEED DATA
-- Default Admin User, Streaming Platforms, Genres, Media Catalog & Availability
-- ==============================================================================

-- 1. Default Admin & Demo Users (password: Admin123!)
INSERT INTO users (id, email, password_hash, full_name, role, is_active, is_verified)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin@movieplatform.com', '$2b$12$e8x5G7w8L3qP1zQx7G1QeuL3dYzO.N6p3uR5kK3kZqM9f6qN5gL9C', 'Platform Administrator', 'admin', TRUE, TRUE),
    ('00000000-0000-0000-0000-000000000002', 'viewer@movieplatform.com', '$2b$12$e8x5G7w8L3qP1zQx7G1QeuL3dYzO.N6p3uR5kK3kZqM9f6qN5gL9C', 'Demo Streaming User', 'user', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. Platforms
INSERT INTO platforms (id, name, icon_url, primary_color) VALUES
    ('netflix', 'Netflix', 'https://upload.wikimedia.org/wikipedia/commons/0/08/Netflix_2015_logo.svg', '#E50914'),
    ('prime', 'Amazon Prime Video', 'https://upload.wikimedia.org/wikipedia/commons/f/f1/Prime_Video.png', '#00A8E1'),
    ('disney', 'Disney+', 'https://upload.wikimedia.org/wikipedia/commons/3/3e/Disney%2B_logo.svg', '#113CCF'),
    ('hbo', 'Max (HBO)', 'https://upload.wikimedia.org/wikipedia/commons/1/17/HBO_Max_Logo.svg', '#002BE7'),
    ('apple', 'Apple TV+', 'https://upload.wikimedia.org/wikipedia/commons/2/28/Apple_TV_Plus_Logo.svg', '#000000'),
    ('paramount', 'Paramount+', 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Paramount_Plus.svg', '#0064FF')
ON CONFLICT (id) DO NOTHING;

-- 3. Genres
INSERT INTO genres (id, name, slug) VALUES
    ('action', 'Action', 'action'),
    ('scifi', 'Sci-Fi', 'sci-fi'),
    ('horror', 'Horror', 'horror'),
    ('drama', 'Drama', 'drama'),
    ('thriller', 'Thriller', 'thriller'),
    ('comedy', 'Comedy', 'comedy'),
    ('adventure', 'Adventure', 'adventure'),
    ('animation', 'Animation', 'animation'),
    ('crime', 'Crime', 'crime'),
    ('mystery', 'Mystery', 'mystery')
ON CONFLICT (id) DO NOTHING;

-- 4. Initial Media Catalog
INSERT INTO media_items (id, imdb_id, tmdb_id, title, type, year, rating, duration_minutes, overview, poster_url, backdrop_url, is_featured) VALUES
    ('insidious-further', 'tt32393988', 1196470, 'Insidious: The Further', 'movie', 2026, 8.4, 114, 'A descent into the darkest reaches of the Further uncovers terrifying entities long forgotten.', 'https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80', TRUE),
    ('spiderman-brand-new-day', 'tt22084616', 569094, 'Spider-Man: Brand New Day', 'movie', 2026, 9.1, 142, 'Peter Parker navigates an entirely new era as Spider-Man while protecting NYC from mysterious syndicate threats.', 'https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1600&q=80', TRUE),
    ('the-odyssey', 'tt0118414', 11974, 'The Odyssey', 'movie', 2026, 8.7, 155, 'A cinematic reimagining of Homer’s epic voyage through mythical seas and timeless trials.', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80', TRUE),
    ('breaking-bad', 'tt0903747', 1396, 'Breaking Bad', 'series', 2008, 9.5, 47, 'A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.', 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1600&q=80', TRUE),
    ('stranger-things', 'tt4574334', 66732, 'Stranger Things', 'series', 2016, 8.7, 50, 'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1509281373149-e957c6296406?auto=format&fit=crop&w=1600&q=80', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5. Seasons & Episodes Seed for Breaking Bad
INSERT INTO seasons (id, media_id, season_number, title, episode_count) VALUES
    ('breaking-bad-s1', 'breaking-bad', 1, 'Season 1', 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO episodes (id, season_id, media_id, episode_number, season_number, title, overview, duration_minutes) VALUES
    ('breaking-bad-s1-e1', 'breaking-bad-s1', 'breaking-bad', 1, 1, 'Pilot', 'Diagnosed with terminal lung cancer, chemistry teacher Walter White teams up with former student Jesse Pinkman.', 58),
    ('breaking-bad-s1-e2', 'breaking-bad-s1', 'breaking-bad', 2, 1, 'Cat''s in the Bag...', 'Walt and Jesse attempt to dispose of two bodies, which proves more difficult than anticipated.', 48),
    ('breaking-bad-s1-e3', 'breaking-bad-s1', 'breaking-bad', 3, 1, '...And the Bag''s in the River', 'Walt wrestles with whether to release Krazy-8 or kill him.', 48)
ON CONFLICT (id) DO NOTHING;
