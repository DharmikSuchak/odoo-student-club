# Student Club Platform

> An independent student-organization platform built for the Odoo Hackathon. It
> does **not** run inside Odoo.

---

## Problem

Student clubs need a lightweight, self-hosted platform to manage memberships,
collect dues, run events with limited tickets, communicate with members, sell
merchandise, coordinate volunteers, and report on finances — all in one place,
without paying for a commercial solution.

---

## Stack

| Layer                | Technology                                               |
| -------------------- | -------------------------------------------------------- |
| Frontend             | React 18 + TypeScript (Vite)                             |
| Styling              | Vanilla CSS (design-token–based)                         |
| API                  | Node.js + Express + TypeScript                           |
| Permanent data store | **MongoDB** (sole source of truth)                       |
| Ephemeral store      | **Redis** (rate limiting; sessions/jobs only when built) |
| Local development    | Docker Compose                                           |
| Package manager      | npm workspaces                                           |

**Why this stack?** As a solo developer I can implement and verify this stack
confidently.

**Key trade-off:** MongoDB does not enforce foreign-key constraints. Every
cross-collection reference is protected by application-layer validation,
explicit indexes, MongoDB transactions for multi-document writes, and tests. See
[`docs/architecture.md`](docs/architecture.md) for the full decision log.

**No PostgreSQL.** Adding a second relational database would exceed the scope of
a solo hackathon project.

---

## Feature Roadmap

| Phase | Status      | Features                                                                                                              |
| ----- | ----------- | --------------------------------------------------------------------------------------------------------------------- |
| 1     | `(done)`    | **Authentication and roles** — register, login (bcrypt + JWT), role assignment (member / officer / treasurer / admin) |
| 2     | `(done)`    | **Memberships and dues** — tier management, payment recording (server-side confirmed only), membership-status badges  |
| 3     | `(planned)` | **Events and limited tickets** — event CRUD, capacity enforcement, registration, waitlist                             |
| 4     | `(done)`    | **Announcements** — organizer publishing/editing, pinned ordering, detail view, and per-browser unread hints          |
| 5     | `(planned)` | **Merchandise** — catalog, order flow                                                                                 |
| 6     | `(planned)` | **Volunteer tasks** — task board, volunteer assignments, completion tracking                                          |
| 7     | (done)      | **Expenses and treasurer reporting** — submission, review, reimbursement, currency-safe computed report               |

---

## Repository Layout

```
odoo-student-club/
├── AGENTS.md                  ← Coding-agent rules (read this first)
├── CLAUDE.md                  ← Short pointer for Claude agents
├── README.md                  ← This file
├── package.json               ← npm workspaces root
├── .prettierrc                ← Prettier config (all packages)
├── .gitignore
├── .env.example               ← Copy to .env before running
├── docker-compose.yml         ← MongoDB, Redis, API, client (with health checks)
├── docker/
│   └── mongo-rs-init.sh       ← Idempotent replica-set initialiser
├── docs/
│   ├── architecture.md        ← Tech choices, service diagram, vertical slice
│   ├── design-system.md       ← Fonts, colors, components, motion
│   └── data-model.md          ← Entity map (Phase 0 proposal)
├── apps/
│   ├── web/                   ← React + TypeScript frontend (Vite)
│   │   └── src/
│   │       ├── features/status/  ← API health status page
│   │       ├── hooks/            ← useApiHealth
│   │       └── lib/              ← api-client.ts
│   └── api/                   ← Express + TypeScript backend
│       └── src/
│           ├── config/        ← env.ts (zod startup validation)
│           ├── middleware/    ← error-handler, request-logger
│           └── routes/        ← health.ts + health.test.ts
```

---

## Local Setup

### Prerequisites

- Docker and Docker Compose
- Node.js ≥ 20

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd odoo-student-club

# 2. Copy environment template and fill in values
cp .env.example .env
#    Edit .env — at minimum set JWT_SECRET (≥ 32 random characters)
#    Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Start all services (MongoDB replica set initialises automatically)
docker compose up -d

# 4. Check service health
docker compose ps
docker compose logs mongo-init   # should end with "rs0 is PRIMARY and ready"

# 5. Verify API health
curl http://localhost:3001/api/health

# 6. Open the frontend
open http://localhost:5173       # shows API reachability status page
```

### Without Docker (local dev)

```bash
npm install
# In separate terminals:
npm run dev -w apps/server # API on :3001
npm run dev -w apps/client # Vite on :5173
```

### Common Recovery Steps

| Problem                         | Fix                                                                 |
| ------------------------------- | ------------------------------------------------------------------- |
| `MongoServerError: not primary` | `docker compose restart mongo && docker compose restart mongo-init` |
| Wipe all data                   | `docker compose down -v`                                            |
| Rebuild after dep changes       | `docker compose build --no-cache server client`                     |
| Force replica-set re-init       | `docker compose run --rm mongo-init`                                |

---

## Available Scripts

| Script                 | Description                 |
| ---------------------- | --------------------------- |
| `npm run dev`          | Start all dev servers       |
| `npm run lint`         | ESLint all packages         |
| `npm run typecheck`    | `tsc --noEmit` all packages |
| `npm test`             | Run all tests               |
| `npm run build`        | Production builds           |
| `npm run format`       | Auto-format with Prettier   |
| `npm run format:check` | Check formatting locally    |

---

## Current Status

Authentication, memberships, announcements, expense submission, treasurer
review/reimbursement, and the treasurer report are implemented end to end.
Finance totals are computed from payment and expense records, grouped by
currency, and label settled versus pending values. All finance endpoints enforce
roles on the server; the UI also provides role-aware navigation and useful empty
states.

The dashboard now reads current active memberships, published future events,
open volunteer tasks, and pending dues from an authenticated summary endpoint.
The application uses the flat `#0887C9` brand palette and `#F4F8FA` page
background.

Members can read pinned-first announcements, open detail views, and see what is
new since their prior browser visit. Officers and admins can publish posts and
edit only posts they authored. Email delivery is intentionally not built yet and
is the next step for this feature. Events, merchandise, and volunteer task flows
remain planned. The report already recognizes event-ticket payment records, so
ticket revenue will appear when the event purchase flow is implemented.

| Item                                            | Status                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `AGENTS.md` — coding-agent rules                | ✅ Done                                                                    |
| `CLAUDE.md` — Claude agent pointer              | ✅ Done                                                                    |
| `docs/design-system.md`                         | ✅ Done                                                                    |
| `docs/architecture.md`                          | ✅ Done                                                                    |
| `docs/data-model.md` (proposal)                 | ✅ Done                                                                    |
| npm workspaces monorepo                         | ✅ Done                                                                    |
| `apps/server` — Express + TypeScript            | ✅ Done                                                                    |
| `apps/client` — React + Vite + TypeScript       | ✅ Done                                                                    |
| TypeScript strict mode (both packages)          | ✅ Done                                                                    |
| ESLint (both packages)                          | ✅ Done                                                                    |
| Prettier (root)                                 | ✅ Done                                                                    |
| `GET /api/health` endpoint                      | ✅ Done                                                                    |
| Legacy status component (not routed)            | ✅ Done                                                                    |
| Env validation at startup (zod)                 | ✅ Done                                                                    |
| Docker Compose (Mongo + Redis + API + Web)      | ✅ Done                                                                    |
| MongoDB single-node replica set (rs0)           | ✅ Done                                                                    |
| Local lint, typecheck, tests, and build scripts | ✅ Available                                                               |
| Typecheck                                       | ✅ Client and server pass                                                  |
| Existing tests                                  | Client: 1 passed; server: 44 passed, 10 pre-existing membership tests fail |
| Production build                                | ✅ Client and server pass                                                  |
| Authentication (Phase 1 features)               | Implemented                                                                |
| Expenses and reimbursements                     | ✅ Implemented with auditable treasurer decisions                          |
| Treasurer report                                | ✅ Computed by currency from payments and approved expenses                |
| Live dashboard statistics                       | ✅ Computed from membership, event, and task records                       |
| Club announcements                              | ✅ Pinned-first list, detail, organizer composer, and unread hints         |

---

Local verification on 2026-10-03: lint, type checks, and both production builds
pass. The announcement, finance, and dashboard-focused tests pass; a
Docker-backed announcement smoke flow also passes. The full server suite still
has 10 pre-existing membership-test failures caused by its in-process
role-promotion fixture.

## Agent Instructions

Every coding agent must read **`AGENTS.md`** before making any change. Rules
cover naming, function design, formatting, TypeScript strict mode, error
handling, secrets, input validation, database query safety, output encoding,
authentication, authorization, payment integrity, testing, and README honesty.

---

## License

TBD.
