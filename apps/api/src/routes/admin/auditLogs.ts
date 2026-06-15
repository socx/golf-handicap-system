import http from 'node:http';
import { dbPool } from '../../lib/db';
import { sendError, sendJson } from '../../lib/http';
import { verifyAdminAndLog } from '../../middleware/auth';

interface AuditLogRow {
  id: string;
  event_type: string;
  user_id: string | null;
  actor_user_id: string | null;
  ip_address: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parsePagination(requestUrl: URL): { page: number; limit: number; offset: number } {
  const pageRaw = Number(requestUrl.searchParams.get('page') || '1');
  const limitRaw = Number(requestUrl.searchParams.get('limit') || '20');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 20;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function parseDateFilter(value: string, boundary: 'start' | 'end'): string | null {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
    return `${value}${suffix}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseEventTypes(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function isSensitiveKey(key: string): boolean {
  return /(password|pass|token|secret|authorization|cookie|jwt|refresh)/i.test(key);
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadataValue(item));
  }

  if (value && typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) continue;
      cleaned[key] = sanitizeMetadataValue(nestedValue);
    }
    return cleaned;
  }

  return value;
}

export async function handleListAuditLogs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const authResult = await verifyAdminAndLog(req);
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const userId = (requestUrl.searchParams.get('userId') || requestUrl.searchParams.get('user') || '').trim();
  if (userId && !isUuid(userId)) {
    sendError(res, 400, 'validation_error', 'userId must be a valid UUID', [{ field: 'userId', message: 'userId must be a valid UUID' }]);
    return;
  }

  const eventType = (requestUrl.searchParams.get('eventType') || requestUrl.searchParams.get('event') || '').trim();
  const eventTypes = parseEventTypes(eventType);
  const fromRaw = (requestUrl.searchParams.get('from') || '').trim();
  const toRaw = (requestUrl.searchParams.get('to') || '').trim();
  const from = fromRaw ? parseDateFilter(fromRaw, 'start') : null;
  const to = toRaw ? parseDateFilter(toRaw, 'end') : null;

  if (fromRaw && !from) {
    sendError(res, 400, 'validation_error', 'from must be a valid ISO date/time or YYYY-MM-DD value', [{ field: 'from', message: 'from must be a valid date filter' }]);
    return;
  }

  if (toRaw && !to) {
    sendError(res, 400, 'validation_error', 'to must be a valid ISO date/time or YYYY-MM-DD value', [{ field: 'to', message: 'to must be a valid date filter' }]);
    return;
  }

  const { page, limit, offset } = parsePagination(requestUrl);

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (userId) {
    params.push(userId);
    clauses.push(`(user_id = $${params.length} OR actor_user_id = $${params.length})`);
  }

  if (eventTypes.length > 0) {
    params.push(eventTypes);
    clauses.push(`event_type = ANY($${params.length}::text[])`);
  }

  if (from) {
    params.push(from);
    clauses.push(`created_at >= $${params.length}`);
  }

  if (to) {
    params.push(to);
    clauses.push(`created_at <= $${params.length}`);
  }

  const whereClause = clauses.length > 0 ? clauses.join(' AND ') : '1=1';

  try {
    const countResult = await dbPool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM audit_logs
       WHERE ${whereClause}`,
      params,
    );
    const total = Number(countResult.rows[0]?.total || 0);

    const listParams = [...params, limit, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const result = await dbPool.query<AuditLogRow>(
      `SELECT id, event_type, user_id, actor_user_id, ip_address, metadata, created_at
       FROM audit_logs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      listParams,
    );

    const logs = result.rows.map((row) => ({
      id: row.id,
      event_type: row.event_type,
      user_id: row.user_id,
      actor_user_id: row.actor_user_id,
      ip_address: row.ip_address,
      metadata: sanitizeMetadataValue(row.metadata || {}) as Record<string, unknown>,
      created_at: row.created_at,
    }));

    sendJson(res, 200, {
      logs,
      filters: {
        userId: userId || null,
        eventType: eventType || null,
        from: from || null,
        to: to || null,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: total > 0 ? Math.ceil(total / limit) : 0,
      },
      message: 'Audit logs retrieved successfully',
    });
  } catch (error) {
    console.error('[admin.audit-logs] unexpected error:', error);
    sendError(res, 500, 'audit_logs_fetch_failed', 'Unable to retrieve audit logs');
  }
}
