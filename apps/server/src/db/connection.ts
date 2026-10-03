import { MongoClient } from 'mongodb';

import type { Db } from 'mongodb';

let client: MongoClient | null = null;
let database: Db | null = null;

/**
 * Returns a connected MongoClient, creating one on first call.
 *
 * The connection is cached for the lifetime of the process. Tests
 * should call {@link closeDb} in `afterAll` to release resources.
 *
 * @param uri  MongoDB connection string. Must include the replica-set
 *             parameter (`replicaSet=rs0`) for multi-document transactions.
 * @returns The connected MongoClient instance.
 */
export async function connectDb(uri: string): Promise<MongoClient> {
  if (client !== null) {
    return client;
  }

  client = new MongoClient(uri, {
    // Wait up to 5 s for a server to become available before throwing.
    serverSelectionTimeoutMS: 5_000,
    // Heartbeat every 2 s; surface failures quickly in dev.
    heartbeatFrequencyMS: 2_000,
  });

  await client.connect();
  return client;
}

/**
 * Returns the database handle for `dbName`.
 *
 * Requires {@link connectDb} to have been called first.
 *
 * @param dbName  Database name extracted from the connection URI. Defaults to
 *                `student_club` so callers that omit it get the correct DB.
 * @returns The `Db` instance.
 * @throws {Error} If the client has not been connected yet.
 */
export function getDb(dbName = 'student_club'): Db {
  if (client === null) {
    throw new Error('Database client is not connected. Call connectDb() first.');
  }
  if (database === null) {
    database = client.db(dbName);
  }
  return database;
}

/**
 * Closes the MongoDB connection and resets the cached handles.
 *
 * Call this during graceful shutdown and in test `afterAll` blocks.
 */
export async function closeDb(): Promise<void> {
  if (client !== null) {
    await client.close();
    client = null;
    database = null;
  }
}
