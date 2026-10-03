import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

/**
 * Returns a connected Redis client, creating one on first call.
 *
 * The connection is cached for the lifetime of the process.
 * Tests should call {@link closeRedis} in `afterAll` to release resources.
 *
 * @param url  Redis connection URL (e.g. `redis://localhost:6379`).
 * @returns The connected Redis client.
 */
export async function connectRedis(url: string): Promise<ReturnType<typeof createClient>> {
  if (redisClient !== null) {
    return redisClient;
  }

  redisClient = createClient({ url });

  redisClient.on('error', (err: unknown) => {
    console.error('[Redis] Client error:', err);
  });

  await redisClient.connect();
  return redisClient;
}

/**
 * Returns the cached Redis client.
 *
 * @throws {Error} If {@link connectRedis} has not been called yet.
 * @returns The connected Redis client.
 */
export function getRedis(): ReturnType<typeof createClient> {
  if (redisClient === null) {
    throw new Error('Redis client is not connected. Call connectRedis() first.');
  }
  return redisClient;
}

/**
 * Closes the Redis connection and resets the cached handle.
 *
 * Call this during graceful shutdown and in test `afterAll` blocks.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient !== null) {
    await redisClient.quit();
    redisClient = null;
  }
}
