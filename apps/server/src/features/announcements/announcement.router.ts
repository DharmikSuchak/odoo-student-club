import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { requireAuth, requireRole, type AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';

import {
  createAnnouncement,
  getAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from './announcement.service.js';

export const announcementRouter = Router();

const announcementFields = {
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
  isPinned: z.boolean(),
};

const createAnnouncementBodySchema = z
  .object({
    ...announcementFields,
    isPinned: announcementFields.isPinned.optional().default(false),
  })
  .strict();

const updateAnnouncementBodySchema = z
  .object({
    title: announcementFields.title.optional(),
    body: announcementFields.body.optional(),
    isPinned: announcementFields.isPinned.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Provide at least one field to update.');

function getClubId(): string {
  if (env.CLUB_ID.length === 0) throw new AppError('CLUB_ID is not configured.', 500, false);
  return env.CLUB_ID;
}

function requireUser(request: Request): AuthUser {
  const user = request.user;
  if (user === undefined) throw new AppError('Authentication required.', 401);
  return user;
}

function sendValidationError(response: Response, error: z.ZodError): void {
  response.status(422).json({
    status: 'error',
    message: 'Validation failed.',
    fields: error.flatten().fieldErrors,
  });
}

/** List announcements. Authentication is required for every club member. */
announcementRouter.get('/', requireAuth, (_request, response, next) => {
  void (async () => {
    try {
      const announcements = await listAnnouncements(
        getDb().collection('announcements'),
        getDb().collection('users'),
        getClubId(),
      );
      response.status(200).json({ status: 'ok', announcements });
    } catch (error) {
      next(error);
    }
  })();
});

/** Create an announcement. Authentication and officer/admin role are required. */
announcementRouter.post(
  '/',
  requireAuth,
  requireRole('officer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = createAnnouncementBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const announcement = await createAnnouncement(
          getDb().collection('announcements'),
          getDb().collection('users'),
          { ...parsed.data, clubId: getClubId(), authorId: requireUser(request).userId },
        );
        response.status(201).json({ status: 'ok', announcement });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** Get an announcement. Authentication is required for every club member. */
announcementRouter.get(
  '/:id',
  requireAuth,
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      try {
        const announcementId = request.params['id'];
        if (announcementId === undefined) throw new AppError('Missing announcement id.', 400);
        const announcement = await getAnnouncement(
          getDb().collection('announcements'),
          getDb().collection('users'),
          getClubId(),
          announcementId,
        );
        response.status(200).json({ status: 'ok', announcement });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** Edit an announcement. Authentication, officer/admin role, and authorship are required. */
announcementRouter.patch(
  '/:id',
  requireAuth,
  requireRole('officer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = updateAnnouncementBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const announcementId = request.params['id'];
        if (announcementId === undefined) throw new AppError('Missing announcement id.', 400);
        const announcement = await updateAnnouncement(
          getDb().collection('announcements'),
          getDb().collection('users'),
          getClubId(),
          announcementId,
          requireUser(request).userId,
          {
            ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
            ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
            ...(parsed.data.isPinned !== undefined ? { isPinned: parsed.data.isPinned } : {}),
          },
        );
        response.status(200).json({ status: 'ok', announcement });
      } catch (error) {
        next(error);
      }
    })();
  },
);
