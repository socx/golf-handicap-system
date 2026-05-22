import { createClient } from 'redis';
import { env } from '../config/env';

export const redisClient = createClient({ url: env.redisUrl });

export const redisState = { ready: false };

redisClient.on('ready', () => {
  redisState.ready = true;
  console.log('[cache] redis connected');
});

redisClient.on('error', (error: Error) => {
  redisState.ready = false;
  console.error('[cache] redis error:', error.message);
});

redisClient.connect().catch((error: Error) => {
  redisState.ready = false;
  console.warn('[cache] running without redis:', error.message);
});
