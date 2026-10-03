import type { Db } from 'mongodb';
import { MongoClient } from 'mongodb';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDb(uri: string): Promise<MongoClient> {
  if (client !== null) {
    return client;
  }

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5_000,
    // Heartbeat every 2 s; surface failures quickly in dev.
    heartbeatFrequencyMS: 2_000,
  });

  await client.connect();
  return client;
}

export function getDb(dbName = 'student_club'): Db {
  if (client === null) {
    throw new Error('Database client is not connected. Call connectDb() first.');
  }
  if (database === null) {
    database = client.db(dbName);
  }
  return database;
}

export async function closeDb(): Promise<void> {
  if (client !== null) {
    await client.close();
    client = null;
    database = null;
  }
}

export async function disconnectDb(): Promise<void> {
  await closeDb();
}
