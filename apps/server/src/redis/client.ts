import { createClient } from 'redis';

let redisClient: ReturnType<typeof createClient> | null = null;

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

export function getRedis(): ReturnType<typeof createClient> {
  if (redisClient === null) {
    throw new Error('Redis client is not connected. Call connectRedis() first.');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient !== null) {
    await redisClient.quit();
    redisClient = null;
  }
}

export async function disconnectRedis(): Promise<void> {
  await closeRedis();
}
