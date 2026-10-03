import { z } from 'zod';

import { nonEmptyString } from './common.js';

export const clubDocumentSchema = z.object({
  name: nonEmptyString.max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(2000).optional(),
  logoUrl: z.string().url().optional(),

  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ClubDocument = z.infer<typeof clubDocumentSchema>;
