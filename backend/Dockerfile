FROM python:3.11-slim

WORKDIR /app

# System deps (psycopg needs pg_config only when building from source;
# the manylinux wheel bundles libpq, but we keep this for safety).
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry (we use pip directly, but keep this for dev parity)
ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/pyproject.toml backend/uv.lock* ./
RUN pip install --upgrade pip && \
    pip install "poetry>=1.8" && \
    poetry export --without-hashes -o requirements.txt && \
    pip install -r requirements.txt

# App source
COPY backend/app ./app
COPY backend/alembic.ini ./
COPY backend/app/migrations ./app/migrations

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
