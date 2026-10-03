# Architecture — Student Club Platform

> Status: **Phase 1 — runnable monorepo scaffold**. API health endpoint live;
> frontend status page reports API reachability. No business features yet.

---

## 1. Technology Choices

### Rationale

> As a solo developer I can implement and verify this stack confidently.

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | **React 18 + TypeScript** | Component model suits a dashboard-heavy app; strong typing prevents class of bugs early |
| Styling | **Vanilla CSS** (custom properties, BEM-ish) | Full control over design tokens; no utility-class bloat |
| API | **Node.js + Express + TypeScript** | Same language as the frontend; rich middleware ecosystem |
| Permanent store | **MongoDB** (via official driver or Mongoose) | Flexible document model for evolving club schemas; well-understood by the team |
| Ephemeral store | **Redis** | Rate limiting (always); short-lived sessions and job queues only when those features are built |
| Local dev | **Docker Compose** | Reproducible environment; no local MongoDB/Redis installs required |
| Build tooling | **Vite** (frontend) + **tsx / ts-node** (API dev) | Fast HMR; no Webpack config overhead |

### Explicitly Excluded

- **PostgreSQL** — not added. Rationale above.
- **GraphQL** — REST is sufficient for this scope; added complexity not justified.
- **Microservices** — single monorepo API for now; extract only if a clear boundary emerges.

### Key Trade-off

MongoDB does **not** enforce foreign-key constraints. Every cross-collection
reference must be protected by:

1. **Validation** at the application layer (`zod` schemas, domain invariants).
2. **Indexes** on all reference fields (enforced in migration scripts).
3. **Transactions** for multi-document writes that must be atomic.
4. **Tests** for every referential-integrity workflow (e.g. deleting a member
   who has active event registrations).

---

## 2. Repository Layout (Proposed)

```
odoo-student-club/
├── AGENTS.md                  ← Agent rules
├── CLAUDE.md                  ← Claude-specific shortcut
├── README.md
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── architecture.md        ← this file
│   ├── design-system.md
│   └── data-model.md
├── packages/
│   ├── client/                ← React + TypeScript frontend
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── index.css      ← global tokens + reset
│   │       ├── components/    ← shared UI primitives
│   │       ├── features/      ← feature slices (auth, members, events, …)
│   │       ├── hooks/         ← shared custom hooks
│   │       ├── lib/           ← API client, date helpers, formatters
│   │       └── types/         ← shared TS types
│   └── api/                   ← Express + TypeScript backend
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts       ← process entry point (env validation, listen)
│           ├── app.ts         ← Express app factory
│           ├── config/        ← env schema (zod), constants
│           ├── db/            ← MongoDB connection, migrations
│           ├── redis/         ← Redis client, rate-limiter factory
│           ├── middleware/     ← auth, error handler, request logger
│           ├── routes/        ← route registration
│           ├── features/      ← one folder per domain feature
│           │   ├── auth/
│           │   ├── members/
│           │   ├── events/
│           │   └── …
│           └── types/         ← shared server-side types
└── tests/
    └── integration/           ← cross-layer integration tests
```

---

## 3. Service Architecture

```
Browser
  │
  │  HTTPS
  ▼
┌──────────────────────────────┐
│  React App (Vite, port 5173) │
│  - React Router for SPA nav  │
│  - Fetches /api/* via fetch() │
└──────────────┬───────────────┘
               │ HTTP (dev: proxy; prod: reverse proxy)
               ▼
┌──────────────────────────────┐
│  Express API (port 3001)     │
│  - Helmet, CORS, body-parser │
│  - Rate limiter → Redis      │
│  - Auth middleware (JWT)     │
│  - Zod validation per route  │
│  - Feature routers           │
└──────┬───────────────┬───────┘
       │               │
       ▼               ▼
┌────────────┐   ┌────────────┐
│  MongoDB   │   │   Redis    │
│  Port 27017│   │  Port 6379 │
│            │   │            │
│  Permanent │   │ Ephemeral  │
│  club data │   │ rate limits│
│            │   │ (sessions, │
│            │   │  jobs TBD) │
└────────────┘   └────────────┘
```

### Data-Flow Rules

1. The **frontend never reads from MongoDB or Redis directly**. All data access
   goes through the Express API.
2. **Redis holds no permanent state.** Flushing Redis must never cause data
   loss or require manual recovery.
3. **All writes to MongoDB go through the service layer**, never directly from a
   route handler. The service layer enforces business rules.
4. **JWT tokens** are stateless; the API validates the signature on every
   request. A token blacklist in Redis may be added for forced logout.

---

## 4. First Vertical Slice — Authentication

The first buildable slice produces a working login/register flow end-to-end so
the team can verify the full stack before building domain features.

### Scope

- `POST /api/auth/register` — create a member account (name, email, password).
- `POST /api/auth/login` — validate credentials, return a signed JWT.
- `GET /api/auth/me` — return the current user's profile (protected).
- Frontend: Register page, Login page, protected route guard.

### Steps

1. **Environment** — `.env.example` with `MONGO_URI`, `REDIS_URL`,
   `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `CLIENT_ORIGIN`.
2. **Startup validation** — `zod` schema exits if any required variable is
   missing.
3. **MongoDB** — `users` collection, indexes on `email` (unique).
4. **Redis** — rate-limit login attempts (10 per minute per IP).
5. **Register handler** — validate body, check email uniqueness, bcrypt hash
   (rounds ≥ 12), insert, return 201 with safe user object.
6. **Login handler** — validate body, fetch user, compare hash, sign JWT,
   return token.
7. **Auth middleware** — verify JWT, attach `req.user`; 401 on failure.
8. **`GET /me`** — apply middleware, return `req.user`.
9. **Frontend** — React context for auth state, login form, register form,
   redirect on success, protected `<Route>` wrapper.
10. **Tests** — happy path, wrong password, duplicate email, expired token,
    rate-limit trigger.

---

## 5. Boundaries Between MongoDB and Redis

| Concern | Store | Notes |
|---------|-------|-------|
| User accounts | MongoDB | Permanent; includes hashed password, role, profile |
| Club memberships | MongoDB | Permanent; links user → membership tier + payment record |
| Events | MongoDB | Permanent; includes capacity, registrations sub-collection |
| Event registrations | MongoDB | Permanent; ticket allocation per user |
| Announcements | MongoDB | Permanent |
| Merchandise orders | MongoDB | Permanent |
| Expenses / ledger | MongoDB | Permanent; immutable append-only entries |
| Rate-limit counters | Redis | Ephemeral; keyed by `ip:route`; 60 s TTL |
| Login-attempt counters | Redis | Ephemeral; keyed by `email`; 15 min TTL |
| JWT blacklist (optional) | Redis | Ephemeral; only if forced-logout is implemented |
| Session cache (optional) | Redis | Ephemeral; only if a session strategy replaces JWT |
| Job queue (optional) | Redis | Ephemeral; only if background email/notification jobs are added |

**Rule**: if removing all Redis data would break a user-visible feature
(other than rate-limiting), the data belongs in MongoDB.

---

## 6. Feature Sequence (Planned, Not Implemented)

| Phase | Features |
|-------|---------|
| **Phase 1** | Authentication (register, login, JWT, roles) |
| **Phase 2** | Memberships and dues (tiers, payment recording, status badges) |
| **Phase 3** | Events and limited tickets (capacity, registration, waitlist) |
| **Phase 4** | Announcements (publish, audience filter) |
| **Phase 5** | Merchandise (catalog, orders) |
| **Phase 6** | Volunteer tasks (assignments, completion tracking) |
| **Phase 7** | Expenses and treasurer reporting (ledger, export) |

---

## 7. Decision Log

| # | Decision | Rationale | Trade-off |
|---|----------|-----------|-----------|
| 1 | MongoDB as sole permanent store | Solo developer can implement and verify confidently | No FK enforcement; needs validation, indexes, transactions, tests |
| 2 | Redis only for ephemeral data | Clear boundary prevents data loss when Redis is cleared | Cannot use Redis for permanent lookups |
| 3 | No PostgreSQL | Reduce stack complexity for hackathon scope | Cannot use relational joins natively |
| 4 | JWT (stateless) auth | Simpler to implement; no session store required initially | Requires Redis token blacklist for forced logout |
| 5 | Vanilla CSS + design tokens | Full control; enforces design system; no dependency drift | No utility shorthand; requires discipline |
| 6 | Monorepo (`packages/`) | Shared types; single lint/format config | Single deploy surface; extract services only if needed |
