import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { moneySchema } from '../../db/schemas/common.js';
import { EXPENSE_STATUSES } from '../../db/schemas/expense.schema.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';

import {
  buildTreasurerReport,
  createExpense,
  listExpenses,
  listOwnExpenses,
  reimburseExpense,
  reviewExpense,
} from './expense.service.js';

export const expenseRouter = Router();

const createExpenseBodySchema = z
  .object({
    category: z.string().trim().min(1).max(100),
    amountCents: moneySchema.positive('Amount must be greater than zero'),
    currency: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/, 'Use a three-letter currency code')
      .transform((value) => value.toUpperCase()),
    receiptReference: z.string().trim().min(1).max(500),
  })
  .strict();

const reviewExpenseBodySchema = z.object({ decision: z.enum(['approved', 'rejected']) }).strict();

const listExpenseQuerySchema = z.object({ status: z.enum(EXPENSE_STATUSES).optional() }).strict();

function getClubId(): string {
  if (env.CLUB_ID.length === 0) throw new AppError('CLUB_ID is not configured.', 500, false);
  return env.CLUB_ID;
}

function sendValidationError(response: Response, error: z.ZodError): void {
  response.status(422).json({
    status: 'error',
    message: 'Validation failed.',
    fields: error.flatten().fieldErrors,
  });
}

/** Submit an expense. Authentication required; officer, treasurer, or admin only. */
expenseRouter.post(
  '/',
  requireAuth,
  requireRole('officer', 'treasurer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = createExpenseBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const authUser = request.user;
        if (authUser === undefined) throw new AppError('Authentication required.', 401);
        const expense = await createExpense(getDb().collection('expenses'), {
          ...parsed.data,
          clubId: getClubId(),
          submittedBy: authUser.userId,
        });
        response.status(201).json({ status: 'ok', expense });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** List the authenticated organizer's submissions. */
expenseRouter.get(
  '/mine',
  requireAuth,
  requireRole('officer', 'treasurer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      try {
        const authUser = request.user;
        if (authUser === undefined) throw new AppError('Authentication required.', 401);
        const expenses = await listOwnExpenses(
          getDb().collection('expenses'),
          getClubId(),
          authUser.userId,
        );
        response.status(200).json({ status: 'ok', expenses });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** Return the computed report. Authentication required; treasurer or admin only. */
expenseRouter.get(
  '/report',
  requireAuth,
  requireRole('treasurer', 'admin'),
  (_request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      try {
        const summaries = await buildTreasurerReport(
          getDb().collection('payments'),
          getDb().collection('expenses'),
          getClubId(),
        );
        response.status(200).json({ status: 'ok', summaries, generatedAt: new Date() });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** List the club review queue. Authentication required; treasurer or admin only. */
expenseRouter.get(
  '/',
  requireAuth,
  requireRole('treasurer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = listExpenseQuerySchema.safeParse(request.query);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const expenses = await listExpenses(
          getDb().collection('expenses'),
          getClubId(),
          parsed.data.status,
        );
        response.status(200).json({ status: 'ok', expenses });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** Review a pending expense. Authentication required; treasurer or admin only. */
expenseRouter.patch(
  '/:id/review',
  requireAuth,
  requireRole('treasurer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = reviewExpenseBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const authUser = request.user;
        const expenseId = request.params['id'];
        if (authUser === undefined) throw new AppError('Authentication required.', 401);
        if (expenseId === undefined) throw new AppError('Missing expense id.', 400);
        const expense = await reviewExpense(
          getDb().collection('expenses'),
          getClubId(),
          expenseId,
          authUser.userId,
          parsed.data.decision,
        );
        response.status(200).json({ status: 'ok', expense });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** Mark an approved expense paid. Authentication required; treasurer or admin only. */
expenseRouter.patch(
  '/:id/reimburse',
  requireAuth,
  requireRole('treasurer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      try {
        const authUser = request.user;
        const expenseId = request.params['id'];
        if (authUser === undefined) throw new AppError('Authentication required.', 401);
        if (expenseId === undefined) throw new AppError('Missing expense id.', 400);
        const expense = await reimburseExpense(
          getDb().collection('expenses'),
          getClubId(),
          expenseId,
          authUser.userId,
        );
        response.status(200).json({ status: 'ok', expense });
      } catch (error) {
        next(error);
      }
    })();
  },
);
