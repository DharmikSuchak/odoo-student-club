import { z } from 'zod';

import { nonEmptyString, objectIdSchema } from './common.js';

export const TASK_STATUSES = ['not_started', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const taskDocumentSchema = z.object({
  clubId: objectIdSchema,
  createdBy: objectIdSchema,
  title: nonEmptyString.max(200),
  description: nonEmptyString.max(2000),
  status: z.enum(TASK_STATUSES).default('not_started'),
  assigneeId: objectIdSchema.nullable().default(null),
  completedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TaskDocument = z.infer<typeof taskDocumentSchema>;
