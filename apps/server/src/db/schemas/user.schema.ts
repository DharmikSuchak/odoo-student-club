import { z } from 'zod';

import { nonEmptyString } from './common.js';

export const USER_ROLES = ['member', 'officer', 'treasurer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const userDocumentSchema = z.object({
  email: z.string().email('Must be a valid email address').toLowerCase(),
  passwordHash: nonEmptyString, // bcrypt output; never sent to client
  displayName: nonEmptyString.max(80),
  avatarUrl: z.string().url().optional(),
  role: z.enum(USER_ROLES).default('member'),

  // Password reset — token stored as bcrypt hash, single-use, 1-hour TTL
  passwordResetTokenHash: z.string().optional(),
  passwordResetExpiresAt: z.date().optional(),

  emailVerifiedAt: z.date().optional(),

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

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  displayName: nonEmptyString.max(80),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginBody = z.infer<typeof loginBodySchema>;
