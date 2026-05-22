import crypto from 'node:crypto';
import { redisClient, redisState } from './redis';

interface CacheTTL {
  dashboard: number;
  leaderboard: number;
  settings: number;
}

interface CacheResult<T> {
  cacheHit: boolean;
  key: string;
  ttl: number;
  value: T;
}

export const ttlByResource: CacheTTL = {
  dashboard: Number(process.env.CACHE_TTL_DASHBOARD_SECONDS || 60),
  leaderboard: Number(process.env.CACHE_TTL_LEADERBOARD_SECONDS || 45),
  settings: Number(process.env.CACHE_TTL_SETTINGS_SECONDS || 300),
};

const cacheKeysByResource = {
  dashboard: new Set<string>(),
  leaderboard: new Set<string>(),
  settings: new Set<string>(),
};

export function buildCacheKey(resource: keyof CacheTTL, requestUrl: URL): string {
  const params = [...requestUrl.searchParams.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const digest = crypto.createHash('sha1').update(params).digest('hex').slice(0, 12);
  return `ghs:cache:${resource}:${digest}`;
}

export async function getOrSetCache<T>({
  resource,
  requestUrl,
  computeValue,
}: {
  resource: keyof CacheTTL;
  requestUrl: URL;
  computeValue: () => Promise<T>;
}): Promise<CacheResult<T>> {
  const ttl = Math.max(1, Number(ttlByResource[resource] || 60));
  const key = buildCacheKey(resource, requestUrl);

  if (redisState.ready) {
    const cached = await redisClient.get(key);
    if (cached) {
      return { cacheHit: true, key, ttl, value: JSON.parse(cached) as T };
    }
  }

  const value = await computeValue();

  if (redisState.ready) {
    await redisClient.set(key, JSON.stringify(value), { EX: ttl });
    cacheKeysByResource[resource].add(key);
  }

  return { cacheHit: false, key, ttl, value };
}

export async function invalidateCache(
  resource: 'all' | 'dashboard' | 'leaderboard' | 'settings',
): Promise<{ invalidated: number; redisReady: boolean }> {
  if (!redisState.ready) return { invalidated: 0, redisReady: false };

  const targets: Array<keyof CacheTTL> =
    resource === 'all' ? ['dashboard', 'leaderboard', 'settings'] : [resource];

  let invalidated = 0;
  for (const target of targets) {
    const keys = [...cacheKeysByResource[target]];
    if (keys.length > 0) {
      const deleted = await redisClient.del(keys);
      invalidated += Number(deleted || 0);
      cacheKeysByResource[target].clear();
    }
  }

  return { invalidated, redisReady: true };
}

export function buildDashboardSummary(): Record<string, unknown> {
  return {
    activePlayers: 42,
    roundsToday: 18,
    averageHandicap: 14.7,
    generatedAt: new Date().toISOString(),
  };
}

export function buildLeaderboardSummary(url: URL): Record<string, unknown> {
  const clubId = url.searchParams.get('clubId') || 'all';
  return {
    clubId,
    leaders: [
      { playerId: 'p-001', name: 'Player One', points: 128 },
      { playerId: 'p-002', name: 'Player Two', points: 121 },
      { playerId: 'p-003', name: 'Player Three', points: 115 },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function buildSettingsSummary(): Record<string, unknown> {
  return {
    locale: 'en-GB',
    timezone: 'Europe/London',
    featureFlags: {
      leaderboardLiveUpdates: true,
      aiAssistant: false,
    },
    generatedAt: new Date().toISOString(),
  };
}
