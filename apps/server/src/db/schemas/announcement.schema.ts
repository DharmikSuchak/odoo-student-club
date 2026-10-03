import { z } from 'zod';

import { nonEmptyString, objectIdSchema } from './common.js';

export const announcementDocumentSchema = z.object({
  clubId: objectIdSchema,
  authorId: objectIdSchema,
  title: nonEmptyString.max(200),
  body: nonEmptyString.max(10000),
  isPinned: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AnnouncementDocument = z.infer<typeof announcementDocumentSchema>;
