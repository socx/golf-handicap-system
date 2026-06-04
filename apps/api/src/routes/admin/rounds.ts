import http from 'node:http';
import { sendError, sendJson } from '../../lib/http';
import { dbPool } from '../../lib/db';
import { verifyAdminAndLog } from '../../middleware/auth';

interface PendingRoundRow {
  id: string;
  player_id: string;
  player_first_name: string;
  player_last_name: string;
  course_id: string | null;
  course_name: string | null;
  played_at: string;
  gross_score: number | null;
}

export async function handleListPendingRounds(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = await verifyAdminAndLog(req);
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  try {
    const result = await dbPool.query<PendingRoundRow>(
      `SELECT r.id,
              r.player_id,
              p.first_name AS player_first_name,
              p.last_name AS player_last_name,
              tc.course_id,
              c.name AS course_name,
              r.played_at,
              r.gross_score
       FROM rounds r
       INNER JOIN players p ON p.id = r.player_id
       LEFT JOIN tee_configurations tc ON tc.id = r.tee_configuration_id
       LEFT JOIN courses c ON c.id = tc.course_id
       WHERE r.deleted_at IS NULL
         AND r.status = 'pending'
       ORDER BY r.played_at ASC, r.created_at ASC`,
    );

    const pendingRounds = result.rows.map((row) => ({
      id: row.id,
      player: {
        id: row.player_id,
        first_name: row.player_first_name,
        last_name: row.player_last_name,
      },
      course: {
        id: row.course_id,
        name: row.course_name,
      },
      played_at: row.played_at,
      gross_score: row.gross_score,
    }));

    sendJson(res, 200, {
      rounds: pendingRounds,
      total: pendingRounds.length,
      message: 'Pending rounds retrieved successfully',
    });
  } catch (error) {
    console.error('[admin.rounds.pending] unexpected error:', error);
    sendError(res, 500, 'pending_rounds_fetch_failed', 'Unable to retrieve pending rounds');
  }
}
