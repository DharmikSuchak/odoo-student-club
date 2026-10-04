import { Router, type NextFunction, type Request, type Response } from 'express';

import { env } from '../../config/env.js';
import { getDb } from '../../db/connection.js';
import { requireAuth } from '../../middleware/auth.js';

import { getDashboardSummary } from './dashboard.service.js';

export const dashboardRouter = Router();

/** Returns live club counts. Authentication required; all roles may view it. */
dashboardRouter.get(
  '/summary',
  requireAuth,
  (_request: Request, response: Response, next: NextFunction) => {
    void (async () => {
      try {
        const database = getDb();
        const summary = await getDashboardSummary(
          database.collection('memberships'),
          database.collection('events'),
          database.collection('tasks'),
          database.collection('membership_tiers'),
          env.CLUB_ID,
        );
        response.status(200).json({ status: 'ok', summary });
      } catch (error) {
        next(error);
      }
    })();
  },
);
