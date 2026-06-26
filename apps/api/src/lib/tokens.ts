import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { AuthTokens, JWTClaims, User } from '@ghs/types';
import { env } from '../config/env';
import { redisClient, redisState } from './redis';

const localRevokedRefreshTokenDigests = new Map<string, number>();

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function secondsUntilEpoch(epochSeconds: number): number {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.max(1, Number(epochSeconds || 0) - nowSeconds);
}

function isLocallyRevoked(digest: string): boolean {
  const expiresAt = localRevokedRefreshTokenDigests.get(digest);
  if (!expiresAt) return false;
  if (Date.now() >= expiresAt) {
    localRevokedRefreshTokenDigests.delete(digest);
    return false;
  }
  return true;
}

function markLocallyRevoked(digest: string, decodedToken: JWTClaims): void {
  const expiresAt = Number(decodedToken.exp || 0) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return;
  localRevokedRefreshTokenDigests.set(digest, expiresAt);
}

export async function markRefreshTokenBlacklisted(
  refreshToken: string,
  decodedToken: JWTClaims,
): Promise<void> {
  const digest = hashToken(refreshToken);
  markLocallyRevoked(digest, decodedToken);
  if (!redisState.ready) return;
  const blacklistedKey = `ghs:auth:refresh:blacklist:${digest}`;
  const ttl = secondsUntilEpoch(decodedToken.exp || 0);
  await redisClient.set(blacklistedKey, '1', { EX: ttl });
}

export async function ensureRefreshTokenUsable(
  refreshToken: string,
  decodedToken: JWTClaims,
): Promise<boolean> {
  const digest = hashToken(refreshToken);
  if (isLocallyRevoked(digest)) return false;

  if (!redisState.ready) {
    markLocallyRevoked(digest, decodedToken);
    return true;
  }

  const rotatedKey = `ghs:auth:refresh:rotated:${digest}`;
  const blacklistedKey = `ghs:auth:refresh:blacklist:${digest}`;
  const [rotated, blacklisted] = await Promise.all([
    redisClient.exists(rotatedKey),
    redisClient.exists(blacklistedKey),
  ]);

  if (rotated || blacklisted) return false;

  const ttl = secondsUntilEpoch(decodedToken.exp || 0);
  await redisClient.set(rotatedKey, '1', { EX: ttl });
  markLocallyRevoked(digest, decodedToken);
  return true;
}

export function buildAuthTokens(
  user: User,
  extraClaims?: Record<string, unknown>,
): AuthTokens {
  const accessTokenOptions: SignOptions = {
    expiresIn: env.jwtAccessExpiresIn as SignOptions['expiresIn'],
  };
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, tokenType: 'access', ...(extraClaims || {}) },
    env.jwtSecret,
    accessTokenOptions,
  );

  const refreshJti = crypto.randomUUID();
  const refreshTokenOptions: SignOptions = {
    expiresIn: env.jwtRefreshExpiresIn as SignOptions['expiresIn'],
  };
  const refreshToken = jwt.sign(
    { sub: user.id, role: user.role, tokenType: 'refresh', jti: refreshJti },
    env.jwtSecret,
    refreshTokenOptions,
  );

  return { accessToken, refreshToken, expiresIn: env.jwtAccessExpiresIn };
}

export function verifyJwt(token: string): JWTClaims {
  return jwt.verify(token, env.jwtSecret) as JWTClaims;
}
