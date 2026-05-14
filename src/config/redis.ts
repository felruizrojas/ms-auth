import Bull from 'bull';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Cola compartida con ms-users. ms-auth solo consume, ms-users solo produce.
export const userEventsQueue = new Bull('user-events', REDIS_URL);

userEventsQueue.on('error', (err) => {
  console.error('[redis] Error en queue user-events:', err.message);
});

// Cliente KV directo para caché de datos de usuario
export const redisClient = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redisClient.on('error', (err) => {
  console.error('[redis] Error en cliente KV:', err.message);
});
