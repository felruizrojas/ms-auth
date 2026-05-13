import Bull from 'bull';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Cola compartida con ms-users. ms-auth solo consume, ms-users solo produce.
export const userEventsQueue = new Bull('user-events', REDIS_URL);

userEventsQueue.on('error', (err) => {
  console.error('[redis] Error en queue user-events:', err.message);
});
