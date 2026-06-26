import http from 'node:http';
import { dbPool } from '../lib/db';
import { sendError, sendJson } from '../lib/http';
import { verifyAndAuthorize } from '../middleware/auth';

interface SearchSuggestion {
  type: 'player' | 'round' | 'course';
  id: string;
  label: string;
  subtitle?: string;
  path: string;
}

async function getLinkedPlayerIdForUser(userId: string): Promise<string | null> {
  const result = await dbPool.query(
    'SELECT id FROM players WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1',
    [userId],
  );
  return Number(result.rowCount || 0) > 0 ? String(result.rows[0].id) : null;
}

export async function handleGlobalSearch(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestUrl: URL,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin', 'player', 'viewer'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const query = (requestUrl.searchParams.get('q') || '').trim();
  const limitRaw = Number(requestUrl.searchParams.get('limit') || '8');
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 20) : 8;

  if (query.length < 2) {
    sendJson(res, 200, { query, suggestions: [] });
    return;
  }

  const likeQuery = `%${query.toLowerCase()}%`;
  const suggestions: SearchSuggestion[] = [];

  let playerScopeId: string | null = null;
  if (authResult.auth.role === 'player') {
    playerScopeId = await getLinkedPlayerIdForUser(authResult.auth.userId);
  }

  if (authResult.auth.role !== 'viewer') {
    const playerResult = await dbPool.query(
      `SELECT id, first_name, last_name, club
       FROM players
       WHERE deleted_at IS NULL
         AND ($1::uuid IS NULL OR id = $1::uuid)
         AND (
           LOWER(first_name) LIKE $2
           OR LOWER(last_name) LIKE $2
           OR LOWER(COALESCE(club, '')) LIKE $2
         )
       ORDER BY last_name ASC, first_name ASC
       LIMIT $3`,
      [playerScopeId, likeQuery, limit],
    );

    suggestions.push(
      ...playerResult.rows.map((row) => ({
        type: 'player' as const,
        id: String(row.id),
        label: `${row.first_name} ${row.last_name}`,
        subtitle: row.club ? String(row.club) : undefined,
        path: `/players/${row.id}`,
      })),
    );
  }

  const roundResult = await dbPool.query(
    `SELECT r.id, r.played_at, p.first_name, p.last_name, c.name AS course_name
     FROM rounds r
     INNER JOIN players p ON p.id = r.player_id
     LEFT JOIN tee_configurations tc ON tc.id = r.tee_configuration_id
     LEFT JOIN courses c ON c.id = tc.course_id
     WHERE r.deleted_at IS NULL
       AND ($1::uuid IS NULL OR r.player_id = $1::uuid)
       AND (
         LOWER(COALESCE(c.name, '')) LIKE $2
         OR LOWER(COALESCE(p.first_name, '')) LIKE $2
         OR LOWER(COALESCE(p.last_name, '')) LIKE $2
       )
     ORDER BY r.played_at DESC
     LIMIT $3`,
    [playerScopeId, likeQuery, limit],
  );

  suggestions.push(
    ...roundResult.rows.map((row) => ({
      type: 'round' as const,
      id: String(row.id),
      label: `${new Date(String(row.played_at)).toISOString().slice(0, 10)} - ${row.first_name} ${String(row.last_name).charAt(0)}.`,
      subtitle: row.course_name ? String(row.course_name) : undefined,
      path: `/rounds/${row.id}`,
    })),
  );

  const courseResult = await dbPool.query(
    `SELECT id, name, city, country
     FROM courses
     WHERE deleted_at IS NULL
       AND (
         LOWER(name) LIKE $1
         OR LOWER(COALESCE(city, '')) LIKE $1
         OR LOWER(COALESCE(country, '')) LIKE $1
       )
     ORDER BY name ASC
     LIMIT $2`,
    [likeQuery, limit],
  );

  suggestions.push(
    ...courseResult.rows.map((row) => ({
      type: 'course' as const,
      id: String(row.id),
      label: String(row.name),
      subtitle: [row.city, row.country].filter(Boolean).join(', '),
      path: `/courses/${row.id}`,
    })),
  );

  sendJson(res, 200, {
    query,
    suggestions: suggestions.slice(0, limit * 3),
  });
}
