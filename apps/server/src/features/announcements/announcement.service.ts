import { ObjectId, type Collection } from 'mongodb';

import {
  announcementDocumentSchema,
  type AnnouncementDocument,
} from '../../db/schemas/announcement.schema.js';
import { AppError } from '../../middleware/error-handler.js';

export type StoredAnnouncement = AnnouncementDocument & { _id: ObjectId };

export interface AnnouncementView extends StoredAnnouncement {
  authorName: string;
}

interface CreateAnnouncementInput {
  clubId: string;
  authorId: string;
  title: string;
  body: string;
  isPinned: boolean;
}

interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  isPinned?: boolean;
}

interface AnnouncementAuthor {
  _id: ObjectId;
  displayName: string;
}

function parseObjectId(value: string, fieldName: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}: must be a 24-character hex string.`, 400);
  }
  return new ObjectId(value);
}

async function addAuthorName(
  users: Collection,
  announcement: StoredAnnouncement,
): Promise<AnnouncementView> {
  const author = await users.findOne<AnnouncementAuthor>({
    _id: parseObjectId(announcement.authorId, 'authorId'),
  });
  return {
    ...announcement,
    authorName: author?.displayName ?? 'Club organizer',
  };
}

export async function createAnnouncement(
  announcements: Collection,
  users: Collection,
  input: CreateAnnouncementInput,
): Promise<AnnouncementView> {
  const now = new Date();
  const document = announcementDocumentSchema.parse({
    ...input,
    clubId: parseObjectId(input.clubId, 'clubId').toHexString(),
    authorId: parseObjectId(input.authorId, 'authorId').toHexString(),
    createdAt: now,
    updatedAt: now,
  });
  const result = await announcements.insertOne(document);
  const created = await announcements.findOne<StoredAnnouncement>({ _id: result.insertedId });
  if (created === null) {
    throw new AppError('Failed to retrieve the new announcement.', 500, false);
  }
  return addAuthorName(users, created);
}

export async function listAnnouncements(
  announcements: Collection,
  users: Collection,
  clubId: string,
): Promise<AnnouncementView[]> {
  const documents = await announcements
    .find<StoredAnnouncement>(
      { clubId: parseObjectId(clubId, 'clubId').toHexString() },
      { sort: { isPinned: -1, createdAt: -1 } },
    )
    .toArray();
  return Promise.all(documents.map((announcement) => addAuthorName(users, announcement)));
}

export async function getAnnouncement(
  announcements: Collection,
  users: Collection,
  clubId: string,
  announcementId: string,
): Promise<AnnouncementView> {
  const announcement = await announcements.findOne<StoredAnnouncement>({
    _id: parseObjectId(announcementId, 'announcementId'),
    clubId: parseObjectId(clubId, 'clubId').toHexString(),
  });
  if (announcement === null) throw new AppError('Announcement not found.', 404);
  return addAuthorName(users, announcement);
}

export async function updateAnnouncement(
  announcements: Collection,
  users: Collection,
  clubId: string,
  announcementId: string,
  editorId: string,
  input: UpdateAnnouncementInput,
): Promise<AnnouncementView> {
  const objectId = parseObjectId(announcementId, 'announcementId');
  const club = parseObjectId(clubId, 'clubId').toHexString();
  const author = parseObjectId(editorId, 'editorId').toHexString();
  const existing = await announcements.findOne<StoredAnnouncement>({ _id: objectId, clubId: club });
  if (existing === null) throw new AppError('Announcement not found.', 404);
  if (existing.authorId !== author) {
    throw new AppError('Only the original author can edit this announcement.', 403);
  }
  const updateResult = await announcements.updateOne(
    { _id: objectId, clubId: club, authorId: author },
    { $set: { ...input, updatedAt: new Date() } },
  );
  if (updateResult.matchedCount === 0) {
    throw new AppError('Announcement changed before the update was saved.', 409);
  }
  return getAnnouncement(announcements, users, clubId, announcementId);
}
