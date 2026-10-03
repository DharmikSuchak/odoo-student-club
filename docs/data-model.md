# Data Model — Student Club Platform

> **Status: Confirmed through Phase 7.** Zod schemas in
> `apps/server/src/db/schemas/` are the single source of truth.

---

## 1. Overview

All collections live in **MongoDB** (native driver). There are no foreign-key
constraints; referential integrity is enforced by the application layer
(validation, indexes, transactions — see `docs/architecture.md §1`).

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
        └──────< expenses
```

---

## 2. Open Questions Resolved

| #   | Question                                                         | Decision                                                                                                                                        |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Single-club vs. multi-club from the start?                       | Single doc now (`clubs` collection added); `clubId` scoping is present on all club-owned collections.                                           |
| Q2  | Waitlist implementation — document or virtual field?             | Separate `eventTickets` with `status: 'waitlisted'`. Capacity is enforced via an atomic count on `status: 'confirmed'`.                         |
| Q3  | Announcement body — Markdown or rich text (Tiptap)?              | Markdown is used for `body`.                                                                                                                    |
| Q4  | Role model — per-user global or per-club membership?             | Global role on `users` (`member`, `officer`, `treasurer`, `admin`).                                                                             |
| Q5  | Payment provider — Stripe, Razorpay, or mock?                    | Enum `provider` includes `'mock_online'` and `'manual'`, with idempotency tracking via `providerEventId`.                                       |
| Q6  | Soft-delete strategy — `isActive` flag or `deletedAt` timestamp? | `deletedAt` timestamp for auditable soft-delete on users.                                                                                       |
| Q7  | `expenses` — approval workflow needed in MVP?                    | Auditable `pending` → `approved` or `rejected` review, followed by `approved` → `reimbursed` when funds are paid.                               |
| Q8  | Member vs. Non-Member event pricing?                             | Supported on `events` (`memberPriceCents` vs `nonMemberPriceCents`), dynamically resolved at purchase time.                                     |
| Q9  | Merchandise Size-based Stock?                                    | Supported via an optional `variants` array on the item (e.g. `{ size: 'M', stockQuantity: 10 }`).                                               |
| Q10 | Club Year-end Expiry?                                            | `memberships` store explicit `endDate`. Default `durationDays` exists on the tier, but officers can set a fiscal year-end date during creation. |

---

## 3. Core Collections

_Note: For exact fields, required types, and validations, see the Zod schemas in
`apps/server/src/db/schemas/`._

### `users`

- Authentication and global roles.
- `passwordHash` is never sent to the client.
- Soft-deleted via `deletedAt`.

### `membershipTiers` & `memberships`

- **Tiers** define the product template.
- **Memberships** are append-only. They link a user to a tier and billing cycle.
- **Payment Guard**: Status can only become `active` after a server-side
  verified payment or treasurer-recorded manual payment.

### `events` & `eventTickets`

- **Events** support separate `memberPriceCents` and `nonMemberPriceCents`.
- **Tickets** track purchase, capacity, waitlisting, and check-in.
- Ticket payments are represented in the immutable `payments` ledger.

### `merchandiseItems` & `orders`

- **Items** support `variants` for size-based stock.
- **Orders** contain a snapshot of `unitPriceCents`.
- Same strict payment guards as memberships.

### `payments`

- Immutable ledger of all incoming money.
- Unique sparse index on `providerEventId` guarantees webhook idempotency.
- Treasurer reporting counts `succeeded` payments as settled and `pending`
  payments as pending.
- Membership and event-ticket sources are reported separately.

### `expenses`

- Organizers submit `category`, integer `amountCents`, ISO `currency`, and a
  `receiptReference`.
- New records start as `pending`; a treasurer/admin records `approved` or
  `rejected` with `reviewedBy` and `reviewedAt`.
- Approved records can be marked `reimbursed`, recording `reimbursedBy` and
  `reimbursedAt`.
- Approved expenses are pending outgoing; reimbursed expenses are settled
  outgoing. Rejected and unreviewed records do not reduce the balance.

### Treasurer report (computed view)

- No running balance is stored. The API derives the report from `payments` and
  `expenses` on each request.
- Results are grouped by currency so unlike currencies are never added.
- Per currency, income is dues plus ticket revenue; outgoing is approved plus
  reimbursed expenses. The settled balance uses only settled records, while the
  projected balance includes pending income and outgoing.

---

## 4. Money Handling Rule

All money values are stored as **integer minor units** in fields suffixed with
`Cents` (for example, `priceCents` and `amountPaidCents`) and paired with an ISO
currency where records can contain multiple currencies. This eliminates
floating-point errors and prevents unlike currencies from being combined.

---

## 5. Index Migration Checklist

Indexes are managed by `apps/server/src/db/migrate.ts`.

- [x] `users.email` — unique
- [x] `users.role`
- [x] `memberships.userId + status`
- [x] `memberships.tierId`
- [x] `memberships.endDate`
- [x] `memberships.clubId + status + endDate`
- [x] `events.clubId + startsAt`
- [x] `events.isPublished + startsAt`
- [x] `events.clubId + isPublished + startsAt`
- [x] `eventTickets.eventId + status`
- [x] `eventTickets.userId + eventId` — unique
- [x] `payments.providerEventId` — unique sparse
- [x] `payments.relatedEntity.id`
- [x] `payments.status + relatedEntity.type + currency`
- [x] `expenses.clubId + status + createdAt`
- [x] `expenses.clubId + submittedBy + createdAt`
- [x] `orders.userId + status`
- [x] `tasks.clubId + status`
- [x] `volunteerAssignments.taskId + userId` — unique

---

_Last updated: Phase 7 — expenses, computed treasurer reporting, and live
dashboard summaries implemented._
