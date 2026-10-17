"""Seed initial PRD catalog data into the database."""
import asyncio
from datetime import datetime

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.movie import Movie
from app.models.series import Series
from app.models.genre import Genre
from app.models.platform import Platform
from app.models.availability import Availability

async def seed_data():
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        existing = await session.execute(select(Movie))
        if existing.scalars().first():
            print("Database already contains data, skipping seed.")
            return

        print("Seeding PRD movies, series, platforms, and availability...")

        # 1. Genres
        genres_data = [
            "Action", "Adventure", "Sci-Fi", "Drama", "Horror", "Comedy",
            "Thriller", "Romance", "Animation", "Mystery", "Fantasy", "History", "Biography"
        ]
        genre_objs = {}
        for g_name in genres_data:
            slug = g_name.lower().replace(" ", "-")
            g = Genre(name=g_name, slug=slug)
            session.add(g)
            genre_objs[g_name] = g

        await session.flush()

        # 2. Platforms
        platforms_data = [
            {"id": "netflix", "name": "Netflix", "country": "US", "active": True},
            {"id": "prime", "name": "Prime Video", "country": "US", "active": True},
            {"id": "hotstar", "name": "Disney+ / Hotstar", "country": "IN", "active": True},
            {"id": "appletv", "name": "Apple TV+", "country": "US", "active": True},
            {"id": "max", "name": "Max (HBO)", "country": "US", "active": True},
            {"id": "zee5", "name": "Zee5", "country": "IN", "active": True},
            {"id": "jiocinema", "name": "JioCinema", "country": "IN", "active": True},
            {"id": "sonyliv", "name": "SonyLIV", "country": "IN", "active": True},
        ]
        platform_objs = {}
        for p in platforms_data:
            plat = Platform(id=p["id"], name=p["name"], slug=p["id"], country_code=p["country"], active=p["active"])
            session.add(plat)
            platform_objs[p["id"]] = plat

        await session.flush()

        # 3. Movies
        movies = [
            Movie(
                id="m1",
                external_id="tmdb_157336",
                title="Interstellar",
                original_title="Interstellar",
                description="When Earth becomes uninhabitable, a farmer and ex-NASA pilot leads a mission through a wormhole.",
                release_date=datetime(2014, 11, 7),
                runtime=169,
                language="English",
                country="USA",
                rating=8.7,
                poster_url="https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80",
                backdrop_url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1400&auto=format&fit=crop&q=85",
                trailer_url="https://www.youtube.com/watch?v=zSWdZVtXT7E",
                popularity=98.5,
                genres=[genre_objs["Sci-Fi"], genre_objs["Adventure"], genre_objs["Drama"]]
            ),
            Movie(
                id="m2",
                external_id="tmdb_693134",
                title="Dune: Part Two",
                original_title="Dune: Part Two",
                description="Paul Atreides unites with Chani and the Fremen while seeking revenge against conspirators.",
                release_date=datetime(2024, 3, 1),
                runtime=166,
                language="English",
                country="USA",
                rating=8.6,
                poster_url="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80",
                backdrop_url="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1400&auto=format&fit=crop&q=85",
                trailer_url="https://www.youtube.com/watch?v=Way9Dexny3w",
                popularity=96.0,
                genres=[genre_objs["Sci-Fi"], genre_objs["Adventure"], genre_objs["Action"]]
            ),
            Movie(
                id="m3",
                external_id="tmdb_872585",
                title="Oppenheimer",
                original_title="Oppenheimer",
                description="The story of American scientist J. Robert Oppenheimer and the Manhattan Project.",
                release_date=datetime(2023, 7, 21),
                runtime=180,
                language="English",
                country="USA",
                rating=8.9,
                poster_url="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
                backdrop_url="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1400&auto=format&fit=crop&q=85",
                popularity=94.0,
                genres=[genre_objs["Drama"], genre_objs["History"], genre_objs["Biography"]]
            ),
            Movie(
                id="m4",
                external_id="tmdb_569094",
                title="Spider-Man: Across the Spider-Verse",
                original_title="Spider-Man: Across the Spider-Verse",
                description="Miles Morales catapults across the Multiverse encountering a team of Spider-People.",
                release_date=datetime(2023, 6, 2),
                runtime=140,
                language="English",
                country="USA",
                rating=8.7,
                poster_url="https://images.unsplash.com/photo-1604200213928-ba3cf4fc8436?w=600&auto=format&fit=crop&q=80",
                backdrop_url="https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1400&auto=format&fit=crop&q=85",
                popularity=91.0,
                genres=[genre_objs["Animation"], genre_objs["Action"], genre_objs["Sci-Fi"]]
            ),
            Movie(
                id="m5",
                external_id="tmdb_579974",
                title="RRR",
                original_title="RRR (Rise Roar Revolt)",
                description="Two Indian revolutionaries embark on an unchartered path against colonial oppressors.",
                release_date=datetime(2022, 3, 25),
                runtime=187,
                language="Telugu",
                country="India",
                rating=7.8,
                poster_url="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80",
                backdrop_url="https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=1400&auto=format&fit=crop&q=85",
                popularity=90.0,
                genres=[genre_objs["Action"], genre_objs["Drama"], genre_objs["Adventure"]]
            ),
            Movie(
                id="m6",
                external_id="tmdb_545611",
                title="Everything Everywhere All at Once",
                original_title="Everything Everywhere All at Once",
                description="A middle-aged immigrant is swept into an insane adventure exploring parallel realities.",
                release_date=datetime(2022, 4, 8),
                runtime=139,
                language="English",
                country="USA",
                rating=7.8,
                poster_url="https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80",
                backdrop_url="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1400&auto=format&fit=crop&q=85",
                popularity=88.0,
                genres=[genre_objs["Sci-Fi"], genre_objs["Comedy"], genre_objs["Action"]]
            )
        ]

        for m in movies:
            session.add(m)

        # 4. TV Series
        series_list = [
            Series(
                id="s1",
                external_id="tmdb_tv_66732",
                title="Stranger Things",
                description="When a young boy vanishes, a small town uncovers secret experiments and supernatural forces.",
                first_air_date=datetime(2016, 7, 15),
                language="English",
                country="USA",
                rating=8.7,
                poster_url="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80",
                backdrop_url="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1400&auto=format&fit=crop&q=85",
                popularity=99.0,
                genres=[genre_objs["Sci-Fi"], genre_objs["Horror"], genre_objs["Drama"]]
            ),
            Series(
                id="s2",
                external_id="tmdb_tv_100088",
                title="The Last of Us",
                description="After a global pandemic destroys civilization, a survivor takes charge of a 14-year-old girl.",
                first_air_date=datetime(2023, 1, 15),
                language="English",
                country="USA",
                rating=8.8,
                poster_url="https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=600&auto=format&fit=crop&q=80",
                backdrop_url="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1400&auto=format&fit=crop&q=85",
                popularity=97.0,
                genres=[genre_objs["Drama"], genre_objs["Sci-Fi"], genre_objs["Adventure"]]
            ),
            Series(
                id="s3",
                external_id="tmdb_tv_95396",
                title="Severance",
                description="Mark leads office workers whose memories have been surgically divided between work and personal lives.",
                first_air_date=datetime(2022, 2, 18),
                language="English",
                country="USA",
                rating=8.7,
                poster_url="https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=600&auto=format&fit=crop&q=80",
                backdrop_url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1400&auto=format&fit=crop&q=85",
                popularity=93.0,
                genres=[genre_objs["Sci-Fi"], genre_objs["Thriller"], genre_objs["Drama"]]
            )
        ]

        for s in series_list:
            session.add(s)

        await session.flush()

        # 5. Availability records
        avails = [
            Availability(content_type="movie", content_id="m1", platform_id="netflix", country_code="US", available=True, subscription_type="subscription"),
            Availability(content_type="movie", content_id="m1", platform_id="prime", country_code="IN", available=True, subscription_type="included"),
            Availability(content_type="movie", content_id="m1", platform_id="netflix", country_code="IN", available=True, subscription_type="subscription"),
            Availability(content_type="movie", content_id="m2", platform_id="max", country_code="US", available=True, subscription_type="subscription"),
            Availability(content_type="movie", content_id="m2", platform_id="jiocinema", country_code="IN", available=True, subscription_type="included"),
            Availability(content_type="movie", content_id="m5", platform_id="zee5", country_code="IN", available=True, subscription_type="included"),
            Availability(content_type="movie", content_id="m5", platform_id="netflix", country_code="US", available=True, subscription_type="subscription"),
            Availability(content_type="series", content_id="s1", platform_id="netflix", country_code="US", available=True, subscription_type="subscription"),
            Availability(content_type="series", content_id="s1", platform_id="netflix", country_code="IN", available=True, subscription_type="subscription"),
            Availability(content_type="series", content_id="s2", platform_id="max", country_code="US", available=True, subscription_type="subscription"),
            Availability(content_type="series", content_id="s2", platform_id="jiocinema", country_code="IN", available=True, subscription_type="included"),
            Availability(content_type="series", content_id="s3", platform_id="appletv", country_code="US", available=True, subscription_type="subscription"),
            Availability(content_type="series", content_id="s3", platform_id="appletv", country_code="IN", available=True, subscription_type="subscription"),
        ]

        for a in avails:
            session.add(a)

        await session.commit()
        print("[OK] Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
