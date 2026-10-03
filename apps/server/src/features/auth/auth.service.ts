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

const SAFE_USER_PROJECTION = {
  passwordHash: 0,
  passwordResetTokenHash: 0,
  passwordResetExpiresAt: 0,
} as const;

type SafeUserDoc = Omit<
  UserDocument & { _id: ObjectId },
  'passwordHash' | 'passwordResetTokenHash' | 'passwordResetExpiresAt'
>;

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
