import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

export function initializeRedis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (redisClient) {
      return resolve();
    }
    
    const client = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
    });
    
    client.on('connect', () => {
      redisClient = client;
      resolve();
    });
    
    client.on('error', (err: Error) => {
      if (!redisClient) {
        reject(err);
      }
    });
  });
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis не инициализирован');
  }
  return redisClient;
}

export { getRedisClient as redis };
