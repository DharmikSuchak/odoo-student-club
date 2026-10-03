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

| Phase | Status          | Features                                                                                                                                                   |
| ----- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `(done)`        | **Authentication and roles** — register, login (bcrypt + JWT), role assignment (member / officer / treasurer / admin)                                      |
| 2     | `(in progress)` | **Memberships and dues** — tier management, payment recording, and status badges; automated lapse reminders planned                                        |
| 3     | `(in progress)` | **Events and limited tickets** — creation, publishing, atomic reservations, pricing, and check-in implemented; payment, cancellation, and waitlist planned |
| 4     | `(in progress)` | **Announcements** — publishing, editing, pinning, and unread hints implemented; audience targeting and email planned                                       |
| 5     | `(in progress)` | **Merchandise** — catalog, pending orders, and atomic stock implemented; payment and fulfillment planned                                                   |
| 6     | `(done)`        | **Volunteer tasks** — grouped board, optional assignment, protected progress updates, and live status summary                                              |
| 7     | `(in progress)` | **Expenses and treasurer reporting** — ledger and computed report implemented; export planned                                                              |

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

Authentication, memberships, announcements, volunteer tasks, expense submission,
treasurer review/reimbursement, and the treasurer report are implemented end to
end. Finance totals are computed from payment and expense records, grouped by
currency, and label settled versus pending values. Dues, event-ticket payments,
and merchandise-order payments are reported separately and included in total
income. All finance endpoints enforce roles on the server; the UI also provides
role-aware navigation and useful empty states.

Automated membership-lapse reminders are planned; they still require a scheduled
notification or email delivery mechanism.

The dashboard now reads current active memberships, published future events,
open volunteer tasks, and pending dues from an authenticated summary endpoint.
The application uses the flat `#0887C9` brand palette and `#F4F8FA` page
background.

Members can read pinned-first announcements, open detail views, and see what is
new since their prior browser visit. Officers and admins can publish posts and
edit only posts they authored. Audience targeting and email delivery are
planned. The volunteer board groups work by status, shows live summary counts,
and lets assignees advance their own tasks.

Officers and admins can create and publish events with capacities and separate
member and nonmember prices. Students can browse event details and request
tickets. The server verifies active membership before applying the member rate,
and the final seat is protected by an atomic capacity condition inside the same
MongoDB transaction as the ticket insert. Free tickets are confirmed
immediately; paid requests remain explicitly pending because no verified payment
mechanism exists yet. Officers and admins can check in each confirmed ticket
once. Payment settlement, ticket cancellation, and waitlisting are planned.

The store now allows officers to manage merchandise products with size-based
variants. Members can browse the catalog and place orders. Stock is managed
atomically per-variant to prevent race conditions during checkout. Payment
processing is currently deferred; order placement halts at a clear pending
state. The report recognizes event-ticket and merchandise-order payment records,
but neither unfinished payment flow produces settled records yet.

| Item                                            | Status                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| `AGENTS.md` — coding-agent rules                | ✅ Done                                                                      |
| `CLAUDE.md` — Claude agent pointer              | ✅ Done                                                                      |
| `docs/design-system.md`                         | ✅ Done                                                                      |
| `docs/architecture.md`                          | ✅ Done                                                                      |
| `docs/data-model.md` (proposal)                 | ✅ Done                                                                      |
| npm workspaces monorepo                         | ✅ Done                                                                      |
| `apps/server` — Express + TypeScript            | ✅ Done                                                                      |
| `apps/client` — React + Vite + TypeScript       | ✅ Done                                                                      |
| TypeScript strict mode (both packages)          | ✅ Done                                                                      |
| ESLint (both packages)                          | ✅ Done                                                                      |
| Prettier (root)                                 | ✅ Done                                                                      |
| `GET /api/health` endpoint                      | ✅ Done                                                                      |
| Legacy status component (not routed)            | ✅ Done                                                                      |
| Env validation at startup (zod)                 | ✅ Done                                                                      |
| Docker Compose (Mongo + Redis + API + Web)      | ✅ Done                                                                      |
| MongoDB single-node replica set (rs0)           | ✅ Done                                                                      |
| Local lint, typecheck, tests, and build scripts | ✅ Available                                                                 |
| Typecheck                                       | ✅ Client and server pass                                                    |
| Existing tests                                  | Client: 1 passed; server: 76 passed                                          |
| Production build                                | ✅ Client and server pass                                                    |
| Authentication (Phase 1 features)               | Implemented                                                                  |
| Expenses and reimbursements                     | ✅ Implemented with auditable treasurer decisions                            |
| Treasurer report                                | ✅ Dues, tickets, merchandise, expenses, and balances grouped by currency    |
| Live dashboard statistics                       | ✅ Computed from membership, event, and task records                         |
| Club announcements                              | ✅ Pinned-first list, detail, organizer composer, and unread hints           |
| Volunteer task board                            | ✅ Grouped statuses, assignments, summary counts, and protected transitions  |
| Merchandise store                               | ✅ Catalog, size variants, atomic stock decrements, and deferred payment     |
| Events and ticketing                            | Creation, publishing, atomic reservations, pricing, and check-in implemented |

---

Local verification on 2026-10-03: lint, type checks, and both production builds
pass. The event-capacity, volunteer-task, announcement, store, finance, and
dashboard-focused tests pass; Docker-backed volunteer and announcement smoke
flows also pass. The full server suite now passes completely, including the
previously failing membership tests!

## Agent Instructions

Every coding agent must read **`AGENTS.md`** before making any change. Rules
cover naming, function design, formatting, TypeScript strict mode, error
handling, secrets, input validation, database query safety, output encoding,
authentication, authorization, payment integrity, testing, and README honesty.

---

## License

TBD.
