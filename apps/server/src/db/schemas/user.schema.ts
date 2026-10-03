/**
 * Zod schema for the `users` collection.
 *
 * Stores authentication credentials and basic profile data.
 * Passwords are NEVER stored in plaintext; only bcrypt hashes (rounds ≥ 12).
 * See AGENTS.md §10.
 *
 * Decisions (resolved in Prompt 3):
 * - Role is global per user (not per-club). Per-club roles can be layered
 *   onto `memberships` later without breaking this schema.
 * - Soft-delete uses `deletedAt: Date | undefined` (auditable timestamp)
 *   rather than a boolean `isActive` flag.
 */
import { z } from 'zod';

import { nonEmptyString } from './common.js';

// ── Role hierarchy ─────────────────────────────────────────────────────────────
export const USER_ROLES = ['member', 'officer', 'treasurer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ── Document schema (shape that lives in MongoDB) ──────────────────────────────
/**
 * Full user document as stored in MongoDB.
 * `passwordHash` is excluded from all client-facing responses.
 */
export const userDocumentSchema = z.object({
  email: z.string().email('Must be a valid email address').toLowerCase(),
  passwordHash: nonEmptyString, // bcrypt output; never sent to client
  displayName: nonEmptyString.max(80),
  avatarUrl: z.string().url().optional(),
  role: z.enum(USER_ROLES).default('member'),

  // Password reset — token stored as bcrypt hash, single-use, 1-hour TTL
  passwordResetTokenHash: z.string().optional(),
  passwordResetExpiresAt: z.date().optional(),

  // Email verification
  emailVerifiedAt: z.date().optional(),

  // Soft-delete: set to a Date when the account is deactivated/banned
  deletedAt: z.date().optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UserDocument = z.infer<typeof userDocumentSchema>;

// ── Safe public shape (strip sensitive fields before sending) ──────────────────
export const safeUserSchema = userDocumentSchema.omit({
  passwordHash: true,
  passwordResetTokenHash: true,
  passwordResetExpiresAt: true,
});

export type SafeUser = z.infer<typeof safeUserSchema>;

// ── Request body schemas (used in route validators) ────────────────────────────
export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  displayName: nonEmptyString.max(80),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
