# Data Model — Student Club Platform

> ⚠️ **PROPOSAL — Phase 0 draft. Refine in Prompt 3.**  
> Field names, types, and relationships are provisional. Do not write
> production queries against this model until it is confirmed.

---

## 1. Overview

All collections live in **MongoDB**. There are no foreign-key constraints;
referential integrity is enforced by the application layer (validation,
indexes, transactions — see `docs/architecture.md §1`).

```
users ──────────< memberships
  │
  ├──────────< eventRegistrations >─────── events
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

## 2. Collections

### 2.1 `users`

Stores authentication credentials and basic profile.

```typescript
interface User {
  _id: ObjectId;
  email: string;           // unique index; validated as email format
  passwordHash: string;    // bcrypt, rounds ≥ 12; never returned to client
  displayName: string;
  avatarUrl?: string;
  role: 'member' | 'officer' | 'treasurer' | 'admin';
  isActive: boolean;       // soft-delete / ban
  createdAt: Date;
  updatedAt: Date;

  // Populated by first successful OAuth or email-verify flow (TBD Phase 1)
  emailVerifiedAt?: Date;

  // Password-reset (single-use token stored as hash)
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
}
```

**Indexes (proposed):**
- `{ email: 1 }` — unique
- `{ role: 1 }` — filter by role

---

### 2.2 `membershipTiers`

Club-defined membership products (e.g. "General Member – $20/year").

```typescript
interface MembershipTier {
  _id: ObjectId;
  clubId: ObjectId;        // ref: clubs
  name: string;
  description?: string;
  durationDays: number;    // e.g. 365 for annual
  priceCents: number;      // stored in smallest unit; 2000 = $20.00
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.3 `memberships`

One document per (user, tier, billing cycle). Append-only for audit trail.

```typescript
interface Membership {
  _id: ObjectId;
  userId: ObjectId;        // ref: users
  tierId: ObjectId;        // ref: membershipTiers
  status: 'active' | 'expired' | 'cancelled' | 'pending_payment';
  startDate: Date;
  endDate: Date;

  // Payment record — only set after server-side confirmation
  paymentId?: ObjectId;    // ref: payments (see §2.9)
  paidAt?: Date;
  amountPaidCents?: number;

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes (proposed):**
- `{ userId: 1, status: 1 }`
- `{ tierId: 1 }`
- `{ endDate: 1 }` — for expiry queries

---

### 2.4 `events`

Club events with optional ticket capacity.

```typescript
interface ClubEvent {
  _id: ObjectId;
  clubId: ObjectId;        // ref: clubs
  createdBy: ObjectId;     // ref: users (officer/admin)
  title: string;
  description: string;
  location?: string;
  startsAt: Date;
  endsAt: Date;
  isPublished: boolean;

  // Ticketing
  hasTickets: boolean;
  ticketCapacity?: number;   // null → unlimited
  registrationDeadline?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes (proposed):**
- `{ clubId: 1, startsAt: -1 }`
- `{ isPublished: 1, startsAt: 1 }`

---

### 2.5 `eventRegistrations`

One document per (user, event) registration. Not a sub-array — separate
collection to allow independent querying and atomic capacity checks.

```typescript
interface EventRegistration {
  _id: ObjectId;
  eventId: ObjectId;       // ref: events
  userId: ObjectId;        // ref: users
  status: 'confirmed' | 'waitlisted' | 'cancelled';
  registeredAt: Date;
  cancelledAt?: Date;
}
```

**Indexes (proposed):**
- `{ eventId: 1, status: 1 }` — for capacity count
- `{ userId: 1, eventId: 1 }` — unique (prevent double registration)

---

### 2.6 `announcements`

```typescript
interface Announcement {
  _id: ObjectId;
  clubId: ObjectId;        // ref: clubs
  authorId: ObjectId;      // ref: users
  title: string;
  body: string;            // Markdown; sanitized before render
  audience: 'all' | 'members' | 'officers';
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.7 `merchandiseItems` + `orders`

```typescript
interface MerchandiseItem {
  _id: ObjectId;
  clubId: ObjectId;
  name: string;
  description?: string;
  priceCents: number;
  stockQuantity: number;   // -1 → unlimited
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Order {
  _id: ObjectId;
  userId: ObjectId;
  lineItems: Array<{
    itemId: ObjectId;      // ref: merchandiseItems
    quantity: number;
    unitPriceCents: number; // snapshot at order time
  }>;
  totalCents: number;
  status: 'pending_payment' | 'paid' | 'fulfilled' | 'cancelled';

  // Payment — only set after server-side confirmation
  paymentId?: ObjectId;
  paidAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.8 `tasks` + `volunteerAssignments`

```typescript
interface Task {
  _id: ObjectId;
  clubId: ObjectId;
  title: string;
  description?: string;
  dueAt?: Date;
  maxVolunteers?: number;
  status: 'open' | 'full' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

interface VolunteerAssignment {
  _id: ObjectId;
  taskId: ObjectId;        // ref: tasks
  userId: ObjectId;        // ref: users
  assignedAt: Date;
  completedAt?: Date;
  notes?: string;
}
```

---

### 2.9 `payments`

Immutable ledger of payment events. Written **only** by server-side webhook or
verified API call — never by client assertion.

```typescript
interface Payment {
  _id: ObjectId;
  provider: 'stripe' | 'razorpay' | 'manual'; // manual = cash recorded by treasurer
  providerEventId?: string;  // external event/charge ID for idempotency
  providerPaymentIntentId?: string;
  amountCents: number;
  currency: string;          // ISO 4217, e.g. 'USD'
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  relatedEntity: {
    type: 'membership' | 'order';
    id: ObjectId;
  };
  paidBy: ObjectId;          // ref: users
  recordedBy?: ObjectId;     // ref: users; set for manual entries
  occurredAt: Date;
  createdAt: Date;
}
```

**Indexes (proposed):**
- `{ providerEventId: 1 }` — unique sparse (idempotency)
- `{ 'relatedEntity.id': 1 }` — reverse lookup

---

### 2.10 `expenses`

Treasurer ledger for outgoing club funds. Append-only.

```typescript
interface Expense {
  _id: ObjectId;
  clubId: ObjectId;
  submittedBy: ObjectId;   // ref: users
  approvedBy?: ObjectId;   // ref: users (treasurer/admin)
  category: string;        // e.g. 'venue', 'printing', 'food'
  description: string;
  amountCents: number;
  currency: string;
  receiptUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

---

### 2.11 `clubs` *(placeholder)*

```typescript
interface Club {
  _id: ObjectId;
  name: string;
  slug: string;            // unique; URL-safe identifier
  description?: string;
  logoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

For Phase 0–2 a single club document is sufficient. Multi-club support can be
layered in later without breaking the schema.

---

## 3. Open Questions (resolve in Prompt 3)

| # | Question | Options |
|---|----------|---------|
| Q1 | Single-club vs. multi-club from the start? | Single doc now; add `clubId` scoping to all collections (already drafted) |
| Q2 | Waitlist implementation — document or virtual field? | Separate `eventRegistrations` with `status: 'waitlisted'` (drafted) vs. a `waitlist` sub-array on the event |
| Q3 | Announcement body — Markdown or rich text (Tiptap)? | Markdown is safer; rich text needs extra sanitization |
| Q4 | Role model — per-user global or per-club membership? | Global role on `users` is simplest for Phase 1; per-club role needs a `clubMemberships` join |
| Q5 | Payment provider — Stripe, Razorpay, or mock? | Mock for hackathon; real provider chosen in Phase 2 |
| Q6 | Soft-delete strategy — `isActive` flag or `deletedAt` timestamp? | `deletedAt` is more auditable; requires filtering in every query |
| Q7 | `expenses` — approval workflow needed in MVP? | Two-status (`pending/approved`) is enough for Phase 7 |

---

## 4. Index Migration Checklist

All indexes must be created via a migration script (not ad-hoc in application
startup). Track them here as they are confirmed:

- [ ] `users.email` — unique
- [ ] `memberships.userId + status`
- [ ] `memberships.endDate`
- [ ] `events.clubId + startsAt`
- [ ] `eventRegistrations.eventId + status`
- [ ] `eventRegistrations.userId + eventId` — unique
- [ ] `payments.providerEventId` — unique sparse

---

*Last updated: Phase 0 — initial entity map (proposal).*
