import type { ObjectId } from 'mongodb';
import { z } from 'zod';

export const supportTicketSchema = z.object({
  clubId: z.string().min(1),
  userId: z.string().min(1),
  userName: z.string().min(1),
  subject: z.string().min(1, 'Subject is required').max(100),
  description: z.string().min(1, 'Description is required').max(2000),
  status: z.enum(['open', 'in_progress', 'resolved']),
  createdAt: z.date(),
  updatedAt: z.date(),
  resolvedAt: z.date().optional(),
});

export type SupportTicketDocument = z.infer<typeof supportTicketSchema> & {
  _id?: ObjectId;
};
