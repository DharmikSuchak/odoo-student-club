import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { objectIdSchema } from '../../db/schemas/common.js';
import { TASK_STATUSES } from '../../db/schemas/task.schema.js';
import { requireAuth, requireRole, type AuthUser } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';

import {
  assignTask,
  createTask,
  listAssignableMembers,
  listTasks,
  updateTaskStatus,
} from './task.service.js';

export const taskRouter = Router();

const createTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2000),
    status: z.enum(TASK_STATUSES).optional().default('not_started'),
    assigneeId: objectIdSchema.nullable().optional().default(null),
  })
  .strict();

const assignTaskBodySchema = z.object({ assigneeId: objectIdSchema.nullable() }).strict();
const updateTaskStatusBodySchema = z.object({ status: z.enum(TASK_STATUSES) }).strict();

function getClubId(): string {
  if (env.CLUB_ID.length === 0) throw new AppError('CLUB_ID is not configured.', 500, false);
  return env.CLUB_ID;
}

function requireUser(request: Request): AuthUser {
  const user = request.user;
  if (user === undefined) throw new AppError('Authentication required.', 401);
  return user;
}

function requireTaskId(request: Request): string {
  const taskId = request.params['id'];
  if (taskId === undefined) throw new AppError('Missing task id.', 400);
  return taskId;
}

function sendValidationError(response: Response, error: z.ZodError): void {
  response.status(422).json({
    status: 'error',
    message: 'Validation failed.',
    fields: error.flatten().fieldErrors,
  });
}

/** List assignable accounts. Authentication and officer/admin role are required. */
taskRouter.get(
  '/members',
  requireAuth,
  requireRole('officer', 'admin'),
  (_request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      try {
        const members = await listAssignableMembers(getDb().collection('users'));
        response.status(200).json({ status: 'ok', members });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** List the volunteer board. Authentication is required for every member. */
taskRouter.get('/', requireAuth, (_request, response, next) => {
  void (async () => {
    try {
      const result = await listTasks(
        getDb().collection('tasks'),
        getDb().collection('users'),
        getClubId(),
      );
      response.status(200).json({ status: 'ok', ...result });
    } catch (error) {
      next(error);
    }
  })();
});

/** Create a task. Authentication and officer/admin role are required. */
taskRouter.post(
  '/',
  requireAuth,
  requireRole('officer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = createTaskBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const task = await createTask(getDb().collection('tasks'), getDb().collection('users'), {
          ...parsed.data,
          clubId: getClubId(),
          createdBy: requireUser(request).userId,
        });
        response.status(201).json({ status: 'ok', task });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** Reassign a task. Authentication and officer/admin role are required. */
taskRouter.patch(
  '/:id/assignee',
  requireAuth,
  requireRole('officer', 'admin'),
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = assignTaskBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const task = await assignTask(
          getDb().collection('tasks'),
          getDb().collection('users'),
          getClubId(),
          requireTaskId(request),
          parsed.data.assigneeId,
        );
        response.status(200).json({ status: 'ok', task });
      } catch (error) {
        next(error);
      }
    })();
  },
);

/** Update task progress. Authentication and assignee-or-organizer access are required. */
taskRouter.patch(
  '/:id/status',
  requireAuth,
  (request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      const parsed = updateTaskStatusBodySchema.safeParse(request.body);
      if (!parsed.success) return sendValidationError(response, parsed.error);
      try {
        const user = requireUser(request);
        const task = await updateTaskStatus(
          getDb().collection('tasks'),
          getDb().collection('users'),
          getClubId(),
          requireTaskId(request),
          { userId: user.userId, role: user.role },
          parsed.data.status,
        );
        response.status(200).json({ status: 'ok', task });
      } catch (error) {
        next(error);
      }
    })();
  },
);
