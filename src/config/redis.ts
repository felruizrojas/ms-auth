import Bull from 'bull';
import Redis from 'ioredis';

const REDIS_BROKER_URL = process.env.REDIS_BROKER_URL || 'redis://localhost:6379';
const REDIS_CACHE_URL  = process.env.REDIS_CACHE_URL  || 'redis://localhost:6379';

// Cola de eventos — ms-auth solo consume, ms-users solo produce vía broker
export const userEventsQueue = new Bull('user-events', REDIS_BROKER_URL);

userEventsQueue.on('error', (err) => {
  console.error('[redis] Error en queue user-events:', err.message);
});

// Redis propio de ms-auth — caché KV de perfiles de usuario
export const redisClient = new Redis(REDIS_CACHE_URL);

redisClient.on('error', (err) => {
  console.error('[redis] Error en cliente KV:', err.message);
});
