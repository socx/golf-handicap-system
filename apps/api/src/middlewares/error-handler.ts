import type { NextFunction, Request, Response } from 'express';
import { sendJson } from '../lib/http';

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const message = error instanceof Error ? error.message : 'Internal server error';
  console.error('[app] unhandled request error:', error);
  sendJson(res, 500, { error: 'internal_error', message });
}
