# Data Model — Student Club Platform

> ⚠️ **Status: Confirmed for Phase 1.**  
> Zod schemas in `apps/server/src/db/schemas/` are the single source of truth.

---

## 1. Overview

All collections live in **MongoDB** (native driver). There are no foreign-key constraints;
referential integrity is enforced by the application layer (validation,
indexes, transactions — see `docs/architecture.md §1`).

```
users ──────────< memberships
  │
  ├──────────< eventTickets       >─────── events
  ├──────────< orders              (merchandise)
  ├──────────< volunteerAssignments >───── tasks
  └──────────< expenses            (treasurer ledger)

clubs ──────────< announcements
        └──────< events
        └──────< tasks
        └──────< merchandiseItems
        └──────< membershipTiers
```

---

## 2. Open Questions Resolved (Prompt 3)

| # | Question | Decision |
|---|----------|----------|
| Q1 | Single-club vs. multi-club from the start? | Single doc now (`clubs` collection added); `clubId` scoping is present on all collections. |
| Q2 | Waitlist implementation — document or virtual field? | Separate `eventTickets` with `status: 'waitlisted'`. Capacity is enforced via an atomic count on `status: 'confirmed'`. |
| Q3 | Announcement body — Markdown or rich text (Tiptap)? | Markdown is used for `body`. |
| Q4 | Role model — per-user global or per-club membership? | Global role on `users` (`member`, `officer`, `treasurer`, `admin`). |
| Q5 | Payment provider — Stripe, Razorpay, or mock? | Enum `provider` includes `'mock_online'` and `'manual'` for Phase 1, with idempotency tracking via `providerEventId`. |
| Q6 | Soft-delete strategy — `isActive` flag or `deletedAt` timestamp? | `deletedAt` timestamp for auditable soft-delete on users. |
| Q7 | `expenses` — approval workflow needed in MVP? | Simple `pending` → `approved` → `reimbursed` workflow. |
| Q8 | Member vs. Non-Member event pricing? | Supported natively on the `events` collection (`memberPriceCents` vs `nonMemberPriceCents`), dynamically resolved at purchase time. |
| Q9 | Merchandise Size-based Stock? | Supported via an optional `variants` array on the item (e.g. `{ size: 'M', stockQuantity: 10 }`). |
| Q10 | Club Year-end Expiry? | `memberships` store explicit `endDate`. Default `durationDays` exists on the tier, but officers can set an explicit fiscal year-end date during creation. |

---

## 3. Core Collections (Summary)

*Note: For exact fields, required types, and validations, see the Zod schemas in `apps/server/src/db/schemas/`.*

### `users`
- Authentication and global roles.
- `passwordHash` is never sent to the client.
- Soft-deleted via `deletedAt`.

### `membershipTiers` & `memberships`
- **Tiers** define the product template.
- **Memberships** are append-only. They link a user to a tier and billing cycle.
- **Payment Guard**: Status can only become `active` after a server-side verified payment.

### `events` & `eventTickets`
- **Events** support separate `memberPriceCents` and `nonMemberPriceCents`.
- **Tickets** (not "registrations" - aligned with terminology) track purchase and capacity.
- Waitlisting is handled by ticket status (`waitlisted`).
- **Check-in**: Tickets have an idempotent `checkedInAt` field set by officers at the door.

### `merchandiseItems` & `orders`
- **Items** support `variants` for size-based stock.
- **Orders** contain a snapshot of `unitPriceCents`.
- Same strict payment guards as memberships.

### `payments`
- Immutable ledger of all incoming money.
- Unique sparse index on `providerEventId` guarantees webhook idempotency.

---

## 4. Money Handling Rule
All money values are stored as **integer minor units** (e.g., cents) in fields suffixed with `Cents` (e.g., `priceCents`, `amountPaidCents`). This eliminates floating-point errors.

---

## 5. Index Migration Checklist

Indexes are managed by `apps/server/src/db/migrate.ts`.

- [x] `users.email` — unique
- [x] `users.role`
- [x] `memberships.userId + status`
- [x] `memberships.tierId`
- [x] `memberships.endDate`
- [x] `events.clubId + startsAt`
- [x] `events.isPublished + startsAt`
- [x] `eventTickets.eventId + status`
- [x] `eventTickets.userId + eventId` — unique
- [x] `payments.providerEventId` — unique sparse
- [x] `payments.relatedEntity.id`
- [x] `orders.userId + status`
- [x] `volunteerAssignments.taskId + userId` — unique

---

*Last updated: Phase 1 — Schema schemas confirmed & mapped via Zod.*
