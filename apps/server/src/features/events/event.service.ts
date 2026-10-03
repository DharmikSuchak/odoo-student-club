import { MongoServerError, ObjectId, type ClientSession, type Db } from 'mongodb';

import {
  eventDocumentSchema,
  eventTicketDocumentSchema,
  type CreateEventBody,
  type EventDocument,
  type EventTicketDocument,
} from '../../db/schemas/event.schema.js';
import { AppError } from '../../middleware/error-handler.js';

export type StoredEvent = EventDocument & { _id: ObjectId };
export type StoredEventTicket = EventTicketDocument & { _id: ObjectId };

export interface EventTicketView extends StoredEventTicket {
  attendeeName: string;
  attendeeEmail: string;
}

export type CreateEventInput = CreateEventBody & {
  clubId: string;
  createdBy: string;
};

interface RequestTicketInput {
  clubId: string;
  eventId: string;
  userId: string;
}

interface UserSummary {
  _id: ObjectId;
  displayName: string;
  email: string;
}

function parseObjectId(value: string, fieldName: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}: must be a 24-character hex string.`, 400);
  }
  return new ObjectId(value);
}

function normalizeClubId(clubId: string): string {
  return parseObjectId(clubId, 'clubId').toHexString();
}

async function findEvent(
  database: Db,
  clubId: string,
  eventId: string,
  session?: ClientSession,
): Promise<StoredEvent | null> {
  return database.collection('events').findOne<StoredEvent>(
    {
      _id: parseObjectId(eventId, 'eventId'),
      clubId: normalizeClubId(clubId),
    },
    session === undefined ? undefined : { session },
  );
}

function assertEventCanAcceptTickets(event: StoredEvent, asOf: Date): void {
  if (!event.isPublished) throw new AppError('This event is not published.', 409);
  if (event.startsAt <= asOf) throw new AppError('Ticket requests are closed for this event.', 409);
  if (event.registrationDeadline !== undefined && event.registrationDeadline <= asOf) {
    throw new AppError('The registration deadline has passed.', 409);
  }
}

async function hasActiveMembership(
  database: Db,
  clubId: string,
  userId: string,
  asOf: Date,
  session: ClientSession,
): Promise<boolean> {
  const membership = await database.collection('memberships').findOne(
    {
      clubId,
      userId,
      status: 'active',
      startDate: { $lte: asOf },
      endDate: { $gt: asOf },
    },
    { session },
  );
  return membership !== null;
}

async function addAttendee(database: Db, ticket: StoredEventTicket): Promise<EventTicketView> {
  const attendee = await database
    .collection('users')
    .findOne<UserSummary>({ _id: parseObjectId(ticket.userId, 'userId') });
  return {
    ...ticket,
    attendeeName: attendee?.displayName ?? 'Club member',
    attendeeEmail: attendee?.email ?? '',
  };
}

async function insertReservedTicket(
  database: Db,
  event: StoredEvent,
  userId: string,
  memberPriceApplied: boolean,
  requestedAt: Date,
  session: ClientSession,
): Promise<StoredEventTicket> {
  const priceCents = memberPriceApplied ? event.memberPriceCents : event.nonMemberPriceCents;
  const document = eventTicketDocumentSchema.parse({
    clubId: event.clubId,
    eventId: event._id.toHexString(),
    userId,
    status: priceCents === 0 ? 'confirmed' : 'pending_payment',
    priceCents,
    currency: event.currency,
    memberPriceApplied,
    requestedAt,
  });
  const result = await database.collection('eventTickets').insertOne(document, { session });
  return { ...document, _id: result.insertedId };
}

async function reserveTicketInTransaction(
  database: Db,
  input: RequestTicketInput,
  session: ClientSession,
): Promise<StoredEventTicket> {
  const clubId = normalizeClubId(input.clubId);
  const eventId = parseObjectId(input.eventId, 'eventId');
  const userId = parseObjectId(input.userId, 'userId').toHexString();
  const requestedAt = new Date();
  const event = await findEvent(database, clubId, input.eventId, session);
  if (event === null) throw new AppError('Event not found.', 404);
  assertEventCanAcceptTickets(event, requestedAt);

  const existingTicket = await database
    .collection('eventTickets')
    .findOne({ eventId: eventId.toHexString(), userId }, { session });
  if (existingTicket !== null) throw new AppError('You already requested a ticket.', 409);

  const memberPriceApplied = await hasActiveMembership(
    database,
    clubId,
    userId,
    requestedAt,
    session,
  );
  // The seat predicate and decrement are atomic; the ticket insert shares this transaction.
  const reservedEvent = await database
    .collection('events')
    .findOneAndUpdate(
      { _id: eventId, clubId, isPublished: true, remainingTicketCount: { $gt: 0 } },
      { $inc: { remainingTicketCount: -1 }, $set: { updatedAt: requestedAt } },
      { returnDocument: 'after', session },
    );
  if (reservedEvent === null) throw new AppError('This event is sold out.', 409);
  return insertReservedTicket(
    database,
    reservedEvent as StoredEvent,
    userId,
    memberPriceApplied,
    requestedAt,
    session,
  );
}

export async function createEvent(database: Db, input: CreateEventInput): Promise<StoredEvent> {
  const now = new Date();
  if (input.startsAt <= now) throw new AppError('Event start must be in the future.', 422);
  const document = eventDocumentSchema.parse({
    clubId: normalizeClubId(input.clubId),
    createdBy: parseObjectId(input.createdBy, 'createdBy').toHexString(),
    title: input.title,
    description: input.description,
    ...(input.location === undefined ? {} : { location: input.location }),
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    isPublished: input.isPublished,
    hasTickets: true,
    ticketCapacity: input.ticketCapacity,
    remainingTicketCount: input.ticketCapacity,
    ...(input.registrationDeadline === undefined
      ? {}
      : { registrationDeadline: input.registrationDeadline }),
    memberPriceCents: input.memberPriceCents,
    nonMemberPriceCents: input.nonMemberPriceCents,
    currency: input.currency,
    createdAt: now,
    updatedAt: now,
  });
  const result = await database.collection('events').insertOne(document);
  return { ...document, _id: result.insertedId };
}

export async function listEvents(
  database: Db,
  clubId: string,
  includeDrafts: boolean,
): Promise<StoredEvent[]> {
  const filter: Record<string, unknown> = {
    clubId: normalizeClubId(clubId),
    startsAt: { $gt: new Date() },
  };
  if (!includeDrafts) filter['isPublished'] = true;
  return database
    .collection('events')
    .find<StoredEvent>(filter, { sort: { startsAt: 1 } })
    .toArray();
}

export async function getEvent(
  database: Db,
  clubId: string,
  eventId: string,
  allowDraft: boolean,
): Promise<StoredEvent> {
  const event = await findEvent(database, clubId, eventId);
  if (event === null || (!allowDraft && !event.isPublished)) {
    throw new AppError('Event not found.', 404);
  }
  return event;
}

export async function publishEvent(
  database: Db,
  clubId: string,
  eventId: string,
): Promise<StoredEvent> {
  const objectId = parseObjectId(eventId, 'eventId');
  const normalizedClubId = normalizeClubId(clubId);
  const now = new Date();
  const published = await database
    .collection('events')
    .findOneAndUpdate(
      { _id: objectId, clubId: normalizedClubId, isPublished: false, startsAt: { $gt: now } },
      { $set: { isPublished: true, updatedAt: now } },
      { returnDocument: 'after' },
    );
  if (published !== null) return published as StoredEvent;
  const existing = await findEvent(database, normalizedClubId, eventId);
  if (existing === null) throw new AppError('Event not found.', 404);
  if (existing.isPublished) return existing;
  throw new AppError('Past events cannot be published.', 409);
}

export async function requestTicket(
  database: Db,
  input: RequestTicketInput,
): Promise<EventTicketView> {
  const session = database.client.startSession();
  try {
    const ticket = await session.withTransaction(() =>
      reserveTicketInTransaction(database, input, session),
    );
    if (ticket === undefined) {
      throw new AppError('Ticket reservation did not complete.', 500, false);
    }
    return addAttendee(database, ticket);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new AppError('You already requested a ticket.', 409);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function getMemberTicket(
  database: Db,
  eventId: string,
  userId: string,
): Promise<EventTicketView | null> {
  const ticket = await database.collection('eventTickets').findOne<StoredEventTicket>({
    eventId: parseObjectId(eventId, 'eventId').toHexString(),
    userId: parseObjectId(userId, 'userId').toHexString(),
  });
  return ticket === null ? null : addAttendee(database, ticket);
}

export async function listEventTickets(
  database: Db,
  clubId: string,
  eventId: string,
): Promise<EventTicketView[]> {
  await getEvent(database, clubId, eventId, true);
  const tickets = await database
    .collection('eventTickets')
    .find<StoredEventTicket>(
      { eventId: parseObjectId(eventId, 'eventId').toHexString() },
      { sort: { requestedAt: 1 } },
    )
    .toArray();
  return Promise.all(tickets.map((ticket) => addAttendee(database, ticket)));
}

export async function checkInTicket(
  database: Db,
  clubId: string,
  eventId: string,
  ticketId: string,
  officerId: string,
): Promise<EventTicketView> {
  await getEvent(database, clubId, eventId, true);
  const objectId = parseObjectId(ticketId, 'ticketId');
  const normalizedEventId = parseObjectId(eventId, 'eventId').toHexString();
  const existing = await database.collection('eventTickets').findOne<StoredEventTicket>({
    _id: objectId,
    eventId: normalizedEventId,
  });
  if (existing === null) throw new AppError('Ticket not found.', 404);
  if (existing.status !== 'confirmed') {
    throw new AppError('Only confirmed tickets can be checked in.', 409);
  }
  if (existing.checkedInAt !== undefined) throw new AppError('Ticket is already checked in.', 409);

  const checkedInAt = new Date();
  const updated = await database.collection('eventTickets').findOneAndUpdate(
    {
      _id: objectId,
      eventId: normalizedEventId,
      status: 'confirmed',
      checkedInAt: { $exists: false },
    },
    {
      $set: {
        checkedInAt,
        checkedInBy: parseObjectId(officerId, 'officerId').toHexString(),
      },
    },
    { returnDocument: 'after' },
  );
  if (updated === null) throw new AppError('Ticket was already checked in.', 409);
  return addAttendee(database, updated as StoredEventTicket);
}
