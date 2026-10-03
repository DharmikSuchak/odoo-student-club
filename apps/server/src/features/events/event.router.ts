import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { createEventBodySchema } from '../../db/schemas/event.schema.js';
import { requireAuth, requireRole, type AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';

import {
  checkInTicket,
  createEvent,
  getEvent,
  getMemberTicket,
  listEvents,
  listEventTickets,
  publishEvent,
  requestTicket,
} from './event.service.js';

export const eventRouter = Router();

const emptyBodySchema = z.object({}).strict();

const listQuerySchema = z
  .object({
    includeDrafts: z.enum(['true', 'false']).optional(),
  })
  .strict();

function requireUser(request: Request): AuthUser {
  if (request.user === undefined) throw new AppError('Authentication required.', 401);
  return request.user;
}

function getClubId(): string {
  if (env.CLUB_ID.length === 0) throw new AppError('CLUB_ID is not configured.', 500, false);
  return env.CLUB_ID;
}

function requireParameter(request: Request, name: string): string {
  const value = request.params[name];
  if (value === undefined) throw new AppError(`Missing ${name}.`, 400);
  return value;
}

function isOrganizer(user: AuthUser): boolean {
  return user.role === 'officer' || user.role === 'admin';
}

function sendValidationError(response: Response, error: z.ZodError): void {
  response.status(422).json({
    status: 'error',
    message: 'Validation failed.',
    fields: error.flatten().fieldErrors,
  });
}

eventRouter.get('/', requireAuth, (request, response, next) => {
  void (async () => {
    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) return sendValidationError(response, parsed.error);
    try {
      const user = requireUser(request);
      const includeDrafts = parsed.data.includeDrafts === 'true';
      if (includeDrafts && !isOrganizer(user)) {
        throw new AppError('Officer or admin access required.', 403);
      }
      response.status(200).json({
        status: 'ok',
        events: await listEvents(getDb(), getClubId(), includeDrafts),
      });
    } catch (error) {
      next(error);
    }
  })();
});

eventRouter.post(
  '/',
  requireAuth,
  requireRole('officer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = createEventBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const event = await createEvent(getDb(), {
          ...parsed.data,
          clubId: getClubId(),
          createdBy: requireUser(request).userId,
        });
        response.status(201).json({ status: 'ok', event });
      } catch (error) {
        next(error);
      }
    })();
  },
);

eventRouter.patch(
  '/:eventId/publish',
  requireAuth,
  requireRole('officer', 'admin'),
  (request, response, next) => {
    void (async () => {
      const parsed = emptyBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const event = await publishEvent(
          getDb(),
          getClubId(),
          requireParameter(request, 'eventId'),
        );
        response.status(200).json({ status: 'ok', event });
      } catch (error) {
        next(error);
      }
    })();
  },
);

eventRouter.post('/:eventId/tickets', requireAuth, (request, response, next) => {
  void (async () => {
    const parsed = emptyBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) return sendValidationError(response, parsed.error);
    try {
      const ticket = await requestTicket(getDb(), {
        clubId: getClubId(),
        eventId: requireParameter(request, 'eventId'),
        userId: requireUser(request).userId,
      });
      response.status(201).json({ status: 'ok', ticket });
    } catch (error) {
      next(error);
    }
  })();
});

eventRouter.get(
  '/:eventId/tickets',
  requireAuth,
  requireRole('officer', 'admin'),
  (request, response, next) => {
    void (async () => {
      try {
        response.status(200).json({
          status: 'ok',
          tickets: await listEventTickets(
            getDb(),
            getClubId(),
            requireParameter(request, 'eventId'),
          ),
        });
      } catch (error) {
        next(error);
      }
    })();
  },
);

eventRouter.patch(
  '/:eventId/tickets/:ticketId/check-in',
  requireAuth,
  requireRole('officer', 'admin'),
  (request, response, next) => {
    void (async () => {
      const parsed = emptyBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const ticket = await checkInTicket(
          getDb(),
          getClubId(),
          requireParameter(request, 'eventId'),
          requireParameter(request, 'ticketId'),
          requireUser(request).userId,
        );
        response.status(200).json({ status: 'ok', ticket });
      } catch (error) {
        next(error);
      }
    })();
  },
);

eventRouter.get('/:eventId', requireAuth, (request, response, next) => {
  void (async () => {
    try {
      const user = requireUser(request);
      const eventId = requireParameter(request, 'eventId');
      const event = await getEvent(getDb(), getClubId(), eventId, isOrganizer(user));
      const ticket = await getMemberTicket(getDb(), eventId, user.userId);
      response.status(200).json({ status: 'ok', event, ticket });
    } catch (error) {
      next(error);
    }
  })();
});
