import { ObjectId, type Db } from 'mongodb';
import { describe, expect, it } from 'vitest';

import { AppError } from '../../middleware/error-handler.js';

import { requestTicket } from './event.service.js';

type Document = Record<string, unknown> & { _id: ObjectId };

function matches(document: Document, filter: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = document[key];
    if (expected instanceof ObjectId) return actual instanceof ObjectId && actual.equals(expected);
    if (expected !== null && typeof expected === 'object') {
      const condition = expected as Record<string, unknown>;
      const greaterThan = condition['$gt'];
      if (greaterThan !== undefined) {
        const matches =
          actual instanceof Date
            ? greaterThan instanceof Date && actual > greaterThan
            : Number(actual) > Number(greaterThan);
        if (!matches) return false;
      }
      const lessThanOrEqual = condition['$lte'];
      if (lessThanOrEqual !== undefined) {
        const matches =
          actual instanceof Date
            ? lessThanOrEqual instanceof Date && actual <= lessThanOrEqual
            : Number(actual) <= Number(lessThanOrEqual);
        if (!matches) return false;
      }
      return true;
    }
    return actual === expected;
  });
}

function createDatabase(initialDocuments: Record<string, Document[]>): Db {
  const collections = new Map(
    Object.entries(initialDocuments).map(([name, documents]) => [name, [...documents]]),
  );

  function collection(name: string) {
    const documents = collections.get(name) ?? [];
    collections.set(name, documents);
    return {
      findOne: (filter: Record<string, unknown>) =>
        Promise.resolve(documents.find((document) => matches(document, filter)) ?? null),
      findOneAndUpdate: (
        filter: Record<string, unknown>,
        update: { $inc?: Record<string, number>; $set?: Record<string, unknown> },
      ) => {
        const document = documents.find((candidate) => matches(candidate, filter));
        if (document === undefined) return Promise.resolve(null);
        for (const [field, amount] of Object.entries(update.$inc ?? {})) {
          document[field] = Number(document[field]) + amount;
        }
        Object.assign(document, update.$set);
        return Promise.resolve({ ...document });
      },
      insertOne: (document: Record<string, unknown>) => {
        const insertedId = new ObjectId();
        documents.push({ ...document, _id: insertedId });
        return Promise.resolve({ insertedId });
      },
    };
  }

  return {
    client: {
      startSession: () => ({
        withTransaction: async <Result>(operation: () => Promise<Result>) => operation(),
        endSession: () => Promise.resolve(),
      }),
    },
    collection,
  } as unknown as Db;
}

describe('event ticket capacity', () => {
  it('allows only one request to reserve the last seat', async () => {
    const clubId = new ObjectId();
    const eventId = new ObjectId();
    const firstUserId = new ObjectId();
    const secondUserId = new ObjectId();
    const future = new Date(Date.now() + 86_400_000);
    const database = createDatabase({
      events: [
        {
          _id: eventId,
          clubId: clubId.toHexString(),
          createdBy: new ObjectId().toHexString(),
          title: 'Last seat event',
          description: '',
          startsAt: future,
          endsAt: new Date(future.getTime() + 3_600_000),
          isPublished: true,
          hasTickets: true,
          ticketCapacity: 1,
          remainingTicketCount: 1,
          memberPriceCents: 1000,
          nonMemberPriceCents: 1500,
          currency: 'INR',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      memberships: [],
      eventTickets: [],
      users: [
        {
          _id: firstUserId,
          displayName: 'First Student',
          email: 'first@example.com',
        },
        {
          _id: secondUserId,
          displayName: 'Second Student',
          email: 'second@example.com',
        },
      ],
    });

    const results = await Promise.allSettled([
      requestTicket(database, {
        clubId: clubId.toHexString(),
        eventId: eventId.toHexString(),
        userId: firstUserId.toHexString(),
      }),
      requestTicket(database, {
        clubId: clubId.toHexString(),
        eventId: eventId.toHexString(),
        userId: secondUserId.toHexString(),
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find((result) => result.status === 'rejected');
    expect(rejection?.status).toBe('rejected');
    if (rejection?.status === 'rejected') {
      expect(rejection.reason).toBeInstanceOf(AppError);
      expect((rejection.reason as AppError).statusCode).toBe(409);
      expect((rejection.reason as AppError).message).toBe('This event is sold out.');
    }
  });
});
