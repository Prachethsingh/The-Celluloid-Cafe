# REST API Reference & Specification

> Legacy prototype reference. Generated HLS/DASH demo manifests and mock entitlement responses have been retired. The active catalog, cookie/session, library, source, and admin behavior is documented in [MVP implementation](../mvp-implementation.md); production authentication claims below are not evidence of completion.

Base URL: `http://localhost:8000/api/v1`

All responses are formatted in JSON with standard HTTP status codes.

---

## HTTP Status Codes

| Code | Status | Description |
| :--- | :--- | :--- |
| **200** | `OK` | Request succeeded; response payload returned. |
| **201** | `Created` | Resource created successfully (e.g. session, watchlist item). |
| **400** | `Bad Request` | Malformed request syntax or invalid parameters. |
| **401** | `Unauthorized` | Missing or invalid authentication token. |
| **403** | `Forbidden` | Authenticated user lacks permission (RBAC violation). |
| **404** | `Not Found` | Requested resource (media item, episode, provider) does not exist. |
| **409** | `Conflict` | Resource conflict (e.g. email already exists in registry). |
| **422** | `Unprocessable Entity` | Schema validation error in request body. |
| **429** | `Too Many Requests` | Rate limit exceeded (limit: 120 req/min). |
| **500** | `Internal Server Error` | Unhandled server exception with structured error payload. |

---

## 1. Authentication Endpoints

### `POST /auth/register`
Creates a new user account.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!",
    "full_name": "John Doe"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "user"
    },
    "tokens": {
      "access_token": "jwt...",
      "refresh_token": "jwt...",
      "expires_in": 3600
    }
  }
  ```

### `POST /auth/login`
Authenticates a user and issues JWT tokens.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```

---

## 2. Vega Streaming Providers Endpoints

### `GET /vega/providers`
Returns all 57 integrated Vega providers from `packages/vega-providers`.
- **Query Parameters**:
  - `type` (optional): `global` | `india` | `english` | `anime`
- **Response `200 OK`**:
  ```json
  {
    "author": "Zenda-Cross",
    "repository": "https://github.com/Zenda-Cross/vega-providers",
    "count": 57,
    "filter": "all",
    "providers": [
      {
        "name": "VMovies",
        "value": "vega",
        "version": "2.45",
        "type": "global",
        "icon": "https://cdn.jsdelivr.net/gh/Zenda-Cross/vega-providers@main/assets/vega.png",
        "url": "https://vegamovies.gallery",
        "hasSettings": true,
        "disabled": false
      }
    ]
  }
  ```

### `GET /vega/manifest`
Returns the raw `manifest.json` from `packages/vega-providers`.

### `GET /vega/urls`
Returns the raw `urls.json` domain mapping from `packages/vega-providers`.

### `GET /vega/streams/:type/:id`
Resolves live, ad-free streaming servers for a given movie or TV episode.
- **Path Parameters**:
  - `type`: `movie` | `series`
  - `id`: IMDb ID (e.g. `tt22084616`) or slug
- **Query Parameters**:
  - `season`: Season number (e.g. `1`)
  - `episode`: Episode number (e.g. `1`)
  - `title`: Media title
- **Response `200 OK`**:
  ```json
  {
    "id": "tt22084616",
    "type": "movie",
    "count": 7,
    "sources": [
      {
        "server": "Vega AutoEmbed (VidLink)",
        "name": "Server 1: Vega Multi-Engine (AutoEmbed HD)",
        "quality": "1080p Full HD",
        "type": "embed",
        "url": "https://vidlink.pro/movie/tt22084616",
        "details": "Bufferless direct streaming engine with multi-language audio & subtitles"
      },
      {
        "server": "Vega Vidsrc Cloud",
        "name": "Server 2: Vega Cloud Mirror (VidSrc)",
        "quality": "1080p / 720p",
        "type": "embed",
        "url": "https://vidsrc.xyz/embed/movie?imdb=tt22084616",
        "details": "Global content delivery cluster with adaptive bitrate"
      },
      {
        "server": "AutoEmbed Mirror",
        "name": "Server 3: AutoEmbed Backup Mirror",
        "quality": "1080p HD",
        "type": "embed",
        "url": "https://autoembed.co/movie/imdb/tt22084616",
        "details": "Secondary backup streaming mirror from Zenda-Cross MultiStream"
      },
      {
        "server": "Vega 2Embed Cluster",
        "name": "Server 4: Vega 2Embed Ultra",
        "quality": "1080p Full HD",
        "type": "embed",
        "url": "https://www.2embed.cc/embed/tt22084616",
        "details": "Fast CDN cluster with dynamic multi-server failover"
      },
      {
        "server": "Vega Torrentio #1",
        "name": "Server 6: Torrentio P2P/Debrid (4k)",
        "quality": "4K UHD",
        "type": "torrent",
        "url": "magnet:?xt=urn:btih:...",
        "details": "Torrentio Stremio debrid stream"
      },
      {
        "server": "Vega Direct Video Stream",
        "name": "Server 7: Direct HTML5 Video Stream",
        "quality": "1080p Direct",
        "type": "direct",
        "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        "details": "Distinct high-bitrate video stream"
      }
    ]
  }
  ```

---

## 3. Playback Sessions & DRM

### `POST /playback/session`
Generates a cryptographically signed playback session.
- **Request Body**:
  ```json
  {
    "type": "movie",
    "content_id": "spiderman-brand-new-day",
    "episode_id": null
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "session_id": "ses_bfgqqrzm",
    "license_token": "lic_9428_...",
    "anti_ad_enforced": true,
    "anti_redirect_enforced": true,
    "expires_at": "2026-10-08T03:00:00Z"
  }
  ```

---

## 4. Health & Monitoring

### `GET /health`
Returns system health, database connectivity, and Redis cache telemetry.
- **Response `200 OK`**:
  ```json
  {
    "status": "healthy",
    "uptime_seconds": 3600,
    "database": "connected",
    "redis": "connected",
    "vega_nodes_active": 57
  }
  ```
