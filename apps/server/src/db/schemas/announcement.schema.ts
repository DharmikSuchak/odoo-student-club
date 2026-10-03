/**
 * Zod schema for the `announcements` collection.
 *
 * Decisions (Prompt 3):
 * - Body uses Markdown (safer and easier to store/sanitize than rich text HTML).
 */
import { z } from 'zod';

import { nonEmptyString, objectIdSchema } from './common.js';

export const ANNOUNCEMENT_AUDIENCES = ['all', 'members', 'officers'] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const announcementDocumentSchema = z.object({
  clubId: objectIdSchema,
  authorId: objectIdSchema, // ref: users
  title: nonEmptyString.max(200),

  /** Markdown body */
  body: nonEmptyString.max(10000),

  audience: z.enum(ANNOUNCEMENT_AUDIENCES).default('all'),

  isPublished: z.boolean().default(false),
  publishedAt: z.date().optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AnnouncementDocument = z.infer<typeof announcementDocumentSchema>;
