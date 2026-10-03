/**
 * Zod schemas for the `tasks` and `volunteerAssignments` collections.
 */
import { z } from 'zod';

import { nonEmptyString, objectIdSchema } from './common.js';

export const TASK_STATUSES = ['open', 'full', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// ── Task Document ──────────────────────────────────────────────────────────────
export const taskDocumentSchema = z.object({
  clubId: objectIdSchema,
  createdBy: objectIdSchema, // ref: users
  title: nonEmptyString.max(200),
  description: z.string().max(2000).optional(),
  dueAt: z.date().optional(),

  /** Max number of volunteers needed. null = unlimited */
  maxVolunteers: z.number().int().positive().nullable().default(null),

  status: z.enum(TASK_STATUSES).default('open'),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TaskDocument = z.infer<typeof taskDocumentSchema>;

// ── Volunteer Assignment Document ──────────────────────────────────────────────
export const volunteerAssignmentDocumentSchema = z.object({
  taskId: objectIdSchema,
  userId: objectIdSchema,
  assignedAt: z.date(),
  completedAt: z.date().optional(),
  notes: z.string().max(1000).optional(),
});

export type VolunteerAssignmentDocument = z.infer<typeof volunteerAssignmentDocumentSchema>;
