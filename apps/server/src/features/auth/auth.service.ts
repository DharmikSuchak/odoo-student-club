/**
 * Auth feature — service layer.
 *
 * All database writes and reads for user authentication are centralised here.
 * Route handlers must not access the database directly.
 *
 * AGENTS.md §2: single-purpose functions, ≤ 40 lines.
 * AGENTS.md §10: bcrypt rounds ≥ 12.
 * AGENTS.md §11: role is never read from the request.
 */
import { hash, compare } from 'bcrypt';
import { ObjectId, type Collection } from 'mongodb';

import {
  userDocumentSchema,
  type UserDocument,
  type RegisterBody,
  type LoginBody,
  USER_ROLES,
} from '../../db/schemas/user.schema.js';
import { AppError } from '../../middleware/error-handler.js';

const BCRYPT_ROUNDS = 12;

/**
 * Safe public projection — fields returned to the client.
 * Excludes `passwordHash`, `passwordResetTokenHash`, `passwordResetExpiresAt`.
 */
const SAFE_USER_PROJECTION = {
  passwordHash: 0,
  passwordResetTokenHash: 0,
  passwordResetExpiresAt: 0,
} as const;

type SafeUserDoc = Omit<
  UserDocument & { _id: ObjectId },
  'passwordHash' | 'passwordResetTokenHash' | 'passwordResetExpiresAt'
>;

/**
 * Creates a new user with `member` role.
 * Rejects duplicate emails with a 409.
 *
 * @param collection  MongoDB `users` collection.
 * @param body        Validated register request body.
 * @returns The inserted user document (safe projection).
 * @throws {AppError} 409 if the email is already in use.
 */
export async function registerUser(
  collection: Collection,
  body: RegisterBody,
): Promise<SafeUserDoc> {
  const existingUser = await collection.findOne({ email: body.email.toLowerCase() });
  if (existingUser !== null) {
    throw new AppError('An account with this email address already exists.', 409);
  }

  const passwordHash = await hash(body.password, BCRYPT_ROUNDS);

  const now = new Date();
  const docToParse = {
    email: body.email.toLowerCase(),
    passwordHash,
    displayName: body.displayName.trim(),
    role: 'member' as const, // role is NEVER read from the request body
    createdAt: now,
    updatedAt: now,
  };

  const parsed = userDocumentSchema.parse(docToParse);
  const result = await collection.insertOne(parsed);

  const inserted = await collection.findOne<SafeUserDoc>(
    { _id: result.insertedId },
    { projection: SAFE_USER_PROJECTION },
  );

  if (inserted === null) {
    throw new AppError('Failed to retrieve newly created user.', 500, false);
  }

  return inserted;
}

/**
 * Validates email + password credentials.
 *
 * @param collection  MongoDB `users` collection.
 * @param body        Validated login request body.
 * @returns The user document (safe projection) on success.
 * @throws {AppError} 401 for any credential mismatch (intentionally vague).
 */
export async function validateCredentials(
  collection: Collection,
  body: LoginBody,
): Promise<SafeUserDoc> {
  const user = await collection.findOne<UserDocument & { _id: ObjectId }>({
    email: body.email.toLowerCase(),
  });

  // Use a constant-time compare even when user is not found, to prevent
  // timing attacks that reveal which emails exist.
  const dummyHash = '$2b$12$invaliddummyhashfortimingneutralityXXXXXXXXXXXXXXXXXXXX';
  const hashToCompare = user?.passwordHash ?? dummyHash;
  const isValid = await compare(body.password, hashToCompare);

  if (user === null || !isValid) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (user.deletedAt instanceof Date) {
    throw new AppError('This account has been deactivated.', 403);
  }

  const safeUser = await collection.findOne<SafeUserDoc>(
    { _id: user._id },
    { projection: SAFE_USER_PROJECTION },
  );

  if (safeUser === null) {
    throw new AppError('Failed to retrieve authenticated user.', 500, false);
  }

  return safeUser;
}

/**
 * Retrieves a safe user document by MongoDB `_id` string.
 *
 * @param collection  MongoDB `users` collection.
 * @param userId      Hex string of the MongoDB `_id`.
 * @returns Safe user document, or null if not found.
 */
export async function findSafeUserById(
  collection: Collection,
  userId: string,
): Promise<SafeUserDoc | null> {
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  return collection.findOne<SafeUserDoc>(
    { _id: new ObjectId(userId), deletedAt: { $exists: false } },
    { projection: SAFE_USER_PROJECTION },
  );
}

/**
 * Promotes a user to `admin` role by email.
 * Intended **only** for the dev seed script — not reachable via any HTTP route.
 *
 * @param collection  MongoDB `users` collection.
 * @param email       Email address of the user to promote.
 * @throws {Error} If the user is not found.
 */
export async function promoteToAdmin(collection: Collection, email: string): Promise<void> {
  const result = await collection.updateOne(
    { email: email.toLowerCase() },
    { $set: { role: 'admin', updatedAt: new Date() } },
  );
  if (result.matchedCount === 0) {
    throw new Error(`No user found with email: ${email}`);
  }
}

export { USER_ROLES };
