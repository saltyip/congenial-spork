# 🔗 URL Shortener

A production-style URL shortening service built with Node.js and PostgreSQL.
Focuses on reliability, performance, and security rather than just the core shortening logic.

## Features

- **URL Shortening** — Counter-based shortening using base62 encoding for clean, compact slugs
- **Custom Short Codes** — Optionally pick your own slug (3-20 alphanumeric chars)
- **Link Expiration** — Set a TTL (in hours) so links auto-expire
- **User Accounts** — Register/login with JWT authentication and bcrypt password hashing
- **Redis Caching** — Read-through cache on redirects to reduce DB load on hot URLs
- **ACID Compliance** — Transactional integrity for all write operations
- **Rate Limiting** — Redis-backed rate limiting on login to prevent brute-force
- **Security** — Helmet headers, CORS, URL validation, input sanitization
- **Graceful Shutdown** — Clean DB/Redis teardown on SIGTERM/SIGINT
- **Health Check** — `/health` endpoint for uptime monitoring

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM) |
| Framework | Express 5 |
| Database | PostgreSQL |
| Cache | Redis |
| Auth | JWT + bcrypt |
| Security | Helmet + CORS |

## API Endpoints

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/users/register` | No | Register a new user |
| POST | `/api/users/login` | No | Login (returns JWT) |

### URLs
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/urls` | Yes | Shorten a URL |
| GET | `/api/urls` | Yes | List your URLs (paginated) |
| GET | `/api/urls/stats/:code` | No | Get click count for a code |
| DELETE | `/api/urls/:code` | Yes | Delete a URL you own |

### Redirect
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/:code` | No | Redirect to original URL |

### System
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | DB + Redis health check |

## How the Shortening Works

Each new URL gets an auto-incremented ID from the database.
That ID is converted to a base62 string (a-z, A-Z, 0-9),
producing short slugs like `aB3x`. Alternatively, users can supply
a custom slug. Redirects check Redis cache first, falling back to
the database on cache miss, and caching the result for subsequent hits.

## Setup

```bash
git clone https://github.com/saltyip/congenial-spork
cd congenial-spork
npm install
```

Create `.env`:
```env
JWT_SECRET=your_secret_here
REDIS_URL=redis://127.0.0.1:6379
PORT=8000
```

Set up the database:
```bash
psql -U postgres -d urlshortner -f setup.sql
```

Run:
```bash
npm run dev
```

## Project Structure

```
├── server.js                  # Entry point, middleware chain, graceful shutdown
├── db.js                      # PostgreSQL connection pool
├── redisClient.js             # Redis client with error resilience
├── setup.sql                  # Database schema
├── routes/
│   ├── urlRoutes.js           # URL CRUD (create, list, stats, delete)
│   ├── userRoutes.js          # Auth (register, login)
│   └── redirectRoute.js       # Short code → original URL redirect
├── middleware/
│   ├── authHandler.js         # JWT verification
│   ├── errorhandler.js        # Centralized error responses
│   ├── logger.js              # Colored request logging
│   └── rateLimiter.js         # Redis-backed login rate limiter
├── services/
│   ├── shortener.js           # Base62 encoding logic
│   └── urlCache.js            # Redis read-through cache for URLs
├── servicehandler/
│   └── bcrypthandler.js       # Password hashing
└── validators/
    └── urlValidator.js        # URL format validation
```
