import http from 'node:http';
import { dbPool } from '../lib/db';
import { readJsonBody, sendError, sendJson } from '../lib/http';
import { verifyAndAuthorize } from '../middleware/auth';

const VALID_CATEGORIES = ['bug', 'feature', 'ui', 'other'] as const;
type FeedbackCategory = (typeof VALID_CATEGORIES)[number];

export async function handleCreateFeedback(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player', 'viewer'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req, 2 * 1024 * 1024);
  } catch (error) {
    sendError(res, 400, 'invalid_json', (error as Error).message);
    return;
  }

  const category = typeof payload.category === 'string' ? payload.category.trim().toLowerCase() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const screenshotDataUrl = typeof payload.screenshotDataUrl === 'string' ? payload.screenshotDataUrl.trim() : null;

  if (!VALID_CATEGORIES.includes(category as FeedbackCategory)) {
    sendError(res, 400, 'validation_error', 'category must be one of: bug, feature, ui, other');
    return;
  }

  if (message.length < 5) {
    sendError(res, 400, 'validation_error', 'message must be at least 5 characters');
    return;
  }

  if (message.length > 4000) {
    sendError(res, 400, 'validation_error', 'message cannot exceed 4000 characters');
    return;
  }

  if (screenshotDataUrl && !screenshotDataUrl.startsWith('data:image/')) {
    sendError(res, 400, 'validation_error', 'screenshotDataUrl must be a valid image data URL');
    return;
  }

  const result = await dbPool.query(
    `INSERT INTO feedback_reports (user_id, category, message, screenshot_data_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, category, message, screenshot_data_url, status, created_at, updated_at`,
    [authResult.auth.userId, category, message, screenshotDataUrl],
  );

  sendJson(res, 201, {
    feedback: result.rows[0],
    message: 'Feedback submitted successfully',
  });
}

export async function handleListFeedback(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const pageRaw = Number(requestUrl.searchParams.get('page') || '1');
  const limitRaw = Number(requestUrl.searchParams.get('limit') || '20');
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : 20;
  const offset = (page - 1) * limit;

  const status = (requestUrl.searchParams.get('status') || '').trim().toLowerCase();
  const where = status ? 'WHERE status = $1' : '';
  const whereParams = status ? [status] : [];

  const countResult = await dbPool.query(
    `SELECT COUNT(*)::int AS total FROM feedback_reports ${where}`,
    whereParams,
  );

  const listParams = [...whereParams, limit, offset];
  const limitIdx = whereParams.length + 1;
  const offsetIdx = whereParams.length + 2;

  const result = await dbPool.query(
    `SELECT fr.id, fr.user_id, u.email::text AS user_email, fr.category, fr.message, fr.screenshot_data_url,
            fr.status, fr.created_at, fr.updated_at
     FROM feedback_reports fr
     LEFT JOIN users u ON u.id = fr.user_id
     ${where}
     ORDER BY fr.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  );

  const total = Number(countResult.rows[0]?.total || 0);

  sendJson(res, 200, {
    feedback: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    },
  });
}
