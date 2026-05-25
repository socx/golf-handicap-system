import http from 'node:http';
import { getClientIp, readJsonBody, sendError } from '../lib/http';
import { logApplicationEvent } from '../lib/audit';

function truncate(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export async function handleReportClientError(req: http.IncomingMessage, res: http.ServerResponse, requestId: string): Promise<void> {
  let payload: Record<string, unknown>;

  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendError(res, 400, 'invalid_json', (error as Error).message);
    return;
  }

  const source = truncate(payload.source, 64) || 'frontend';
  const message = truncate(payload.message, 500) || 'Client error reported';
  const stack = truncate(payload.stack, 5000);
  const name = truncate(payload.name, 120);
  const path = truncate(payload.path, 256);
  const code = truncate(payload.code, 120);
  const statusCode = typeof payload.statusCode === 'number' && Number.isFinite(payload.statusCode) ? Math.trunc(payload.statusCode) : null;
  const userAgent = truncate(payload.userAgent, 256);
  const componentStack = truncate(payload.componentStack, 5000);

  await logApplicationEvent({
    requestId,
    event: 'client_error_reported',
    ipAddress: getClientIp(req),
    metadata: {
      source,
      message,
      stack,
      name,
      path,
      code,
      statusCode,
      userAgent,
      componentStack,
    },
  });

  res.writeHead(204);
  res.end();
}