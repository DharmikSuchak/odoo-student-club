import { Router, type NextFunction, type Request, type Response } from 'express';

import { hash } from 'bcrypt';

import { getDb } from '../../db/connection.js';
import type { UserDocument } from '../../db/schemas/user.schema.js';
import { userDocumentSchema } from '../../db/schemas/user.schema.js';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../middleware/error-handler.js';

const BCRYPT_ROUNDS = 12;

export const userRouter = Router();

userRouter.get('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      const usersCollection = getDb().collection<UserDocument>('users');
      // Require officer or admin role to view all users
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const user = req.user!;
      if (user.role !== 'admin' && user.role !== 'officer' && user.role !== 'treasurer') {
        next(new AppError('Forbidden. Only officers can view the member directory.', 403));
        return;
      }

      const usersCursor = usersCollection.find(
        { deletedAt: { $exists: false } },
        {
          projection: {
            passwordHash: 0,
            passwordResetTokenHash: 0,
            passwordResetExpiresAt: 0,
          },
          sort: { displayName: 1 },
        }
      );

      const users = await usersCursor.toArray();

      res.status(200).json({
        status: 'ok',
        users: users.map(u => ({
          id: (u._id as { toString(): string }).toString(),
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          createdAt: u.createdAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  })();
});

userRouter.post('/', requireAuth, (req: Request, res: Response, next: NextFunction) => {
  void (async () => {
    try {
      // Require admin role to create a user with a specific role
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const adminUser = req.user!;
      if (adminUser.role !== 'admin') {
        next(new AppError('Forbidden. Only admins can create users manually.', 403));
        return;
      }

      const { email, password, displayName, role } = req.body;

      if (!email || !password || !displayName || !role) {
        next(new AppError('Email, password, displayName, and role are required.', 400));
        return;
      }

      const usersCollection = getDb().collection<UserDocument>('users');
      const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        next(new AppError('An account with this email address already exists.', 409));
        return;
      }

      const passwordHash = await hash(password, BCRYPT_ROUNDS);
      const now = new Date();

      const docToParse = {
        email: email.toLowerCase(),
        passwordHash,
        displayName: displayName.trim(),
        role: role,
        createdAt: now,
        updatedAt: now,
      };

      const parsed = userDocumentSchema.parse(docToParse);
      const result = await usersCollection.insertOne(parsed);

      res.status(201).json({
        status: 'ok',
        user: {
          id: result.insertedId.toString(),
          email: parsed.email,
          displayName: parsed.displayName,
          role: parsed.role,
          createdAt: parsed.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  })();
});
