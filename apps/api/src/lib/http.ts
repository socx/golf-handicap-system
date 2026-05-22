import http from 'node:http';
import crypto from 'node:crypto';
import { env } from '../config/env';

interface LogRequestOptions {
  requestId: string;
  req: http.IncomingMessage;
  statusCode: number;
  durationMs: number;
}

export function sendJson(res: http.ServerResponse, statusCode: number, body: Record<string, unknown>): void {
  res.writeHead(statusCode, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function sendError(
  res: http.ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>,
): void {
  const errorBody: Record<string, unknown> = { error: { code, message } };
  if (details) {
    (errorBody.error as Record<string, unknown>).details = details;
  }
  sendJson(res, statusCode, errorBody);
}

export function normalizeRequestId(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return crypto.randomUUID();
  }
  return value.trim().slice(0, 128);
}

export function logRequest({ requestId, req, statusCode, durationMs }: LogRequestOptions): void {
  const userId = typeof req.headers['x-user-id'] === 'string' ? req.headers['x-user-id'] : null;
  console.log(
    JSON.stringify({
      level: 'info',
      event: 'http_request',
      service: 'ghs-api',
      requestId,
      userId,
      method: (req.method || 'GET').toUpperCase(),
      path: req.url || '/',
      statusCode,
      durationMs,
      timestamp: new Date().toISOString(),
    }),
  );
}

export function parseUrl(req: http.IncomingMessage): URL {
  const host = req.headers.host || `localhost:${env.port}`;
  return new URL(req.url || '/', `http://${host}`);
}

export function getClientIp(req: http.IncomingMessage): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim().length > 0) {
    return realIp.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function readJsonBody(
  req: http.IncomingMessage,
  maxBytes: number = 1024 * 1024,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > maxBytes) {
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', (error: Error) => reject(error));
  });
}

export function getBearerToken(req: http.IncomingMessage): string | null {
  const rawHeader = req.headers.authorization;
  if (typeof rawHeader !== 'string') return null;
  const match = rawHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
