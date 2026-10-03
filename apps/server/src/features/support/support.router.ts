import { Router, type Request, type Response, type NextFunction } from 'express';
import { ObjectId } from 'mongodb';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';
import type { SupportTicketDocument } from '../../db/schemas/support.schema.js';
import { supportTicketSchema } from '../../db/schemas/support.schema.js';

export const supportRouter = Router();

supportRouter.post('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const user = req.user!;
      const { subject, description } = req.body;

      if (!subject || !description) {
        next(new AppError('Subject and description are required', 400));
        return;
      }

      const db = getDb();
      const now = new Date();

      const docToParse = {
        clubId: env.CLUB_ID,
        userId: user.userId,
        userName: user.displayName,
        subject,
        description,
        status: 'open' as const,
        createdAt: now,
        updatedAt: now,
      };

      const parsed = supportTicketSchema.parse(docToParse);
      const result = await db.collection<SupportTicketDocument>('supportTickets').insertOne(parsed);

      res.status(201).json({
        status: 'ok',
        ticket: { ...parsed, _id: result.insertedId.toString() },
      });
    } catch (err) {
      next(err);
    }
  })();
});

supportRouter.get('/mine', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const user = req.user!;
      const db = getDb();

      const tickets = await db
        .collection<SupportTicketDocument>('supportTickets')
        .find({ clubId: env.CLUB_ID, userId: user.userId })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({ status: 'ok', tickets });
    } catch (err) {
      next(err);
    }
  })();
});

supportRouter.get('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const user = req.user!;
      if (user.role !== 'admin' && user.role !== 'officer') {
        next(new AppError('Forbidden', 403));
        return;
      }

      const db = getDb();
      const tickets = await db
        .collection<SupportTicketDocument>('supportTickets')
        .find({ clubId: env.CLUB_ID })
        .sort({ createdAt: -1 })
        .toArray();

      res.status(200).json({ status: 'ok', tickets });
    } catch (err) {
      next(err);
    }
  })();
});

supportRouter.patch('/:ticketId/status', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const user = req.user!;
      if (user.role !== 'admin' && user.role !== 'officer') {
        next(new AppError('Forbidden', 403));
        return;
      }

      const { status } = req.body;
      if (!['open', 'in_progress', 'resolved'].includes(status)) {
        next(new AppError('Invalid status', 400));
        return;
      }

      const db = getDb();
      const updateData: Partial<SupportTicketDocument> = {
        status,
        updatedAt: new Date(),
      };

      if (status === 'resolved') {
        updateData.resolvedAt = new Date();
      }

      const result = await db.collection<SupportTicketDocument>('supportTickets').findOneAndUpdate(
        { _id: new ObjectId(req.params.ticketId), clubId: env.CLUB_ID },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      if (!result) {
        next(new AppError('Ticket not found', 404));
        return;
      }

      res.status(200).json({ status: 'ok', ticket: result });
    } catch (err) {
      next(err);
    }
  })();
});
