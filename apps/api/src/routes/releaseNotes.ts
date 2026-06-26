import http from 'node:http';
import { dbPool } from '../lib/db';
import { readJsonBody, sendError, sendJson } from '../lib/http';
import { verifyAndAuthorize } from '../middleware/auth';

const DEFAULT_RELEASE_NOTES = `# What's New

## Initial Release
- Dashboard analytics improvements
- Handicap override tools
- Maintenance banner support
`;

interface ReleaseNotesRow {
  release_notes_markdown: string;
  updated_at: string;
}

async function ensureSettingsRow(): Promise<void> {
  await dbPool.query('INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
}

export async function handleGetReleaseNotes(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    await ensureSettingsRow();
    const result = await dbPool.query<ReleaseNotesRow>(
      `SELECT release_notes_markdown, updated_at
       FROM system_settings
       WHERE id = 1`,
    );

    const row = result.rows[0];
    sendJson(res, 200, {
      markdown: row?.release_notes_markdown || DEFAULT_RELEASE_NOTES,
      updatedAt: row?.updated_at || null,
    });
  } catch (error) {
    console.error('[release-notes.get] unexpected error:', error);
    sendError(res, 500, 'release_notes_read_failed', 'Unable to load release notes');
  }
}

export async function handleUpdateReleaseNotes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    sendError(res, 400, 'invalid_json', (error as Error).message);
    return;
  }

  const markdown = typeof payload.markdown === 'string' ? payload.markdown.trim() : '';
  if (!markdown) {
    sendError(res, 400, 'validation_error', 'markdown is required');
    return;
  }

  if (markdown.length > 20000) {
    sendError(res, 400, 'validation_error', 'markdown cannot exceed 20000 characters');
    return;
  }

  try {
    await ensureSettingsRow();
    const result = await dbPool.query<ReleaseNotesRow>(
      `UPDATE system_settings
       SET release_notes_markdown = $1,
           updated_by = $2,
           updated_at = NOW()
       WHERE id = 1
       RETURNING release_notes_markdown, updated_at`,
      [markdown, authResult.auth.userId],
    );

    sendJson(res, 200, {
      markdown: result.rows[0].release_notes_markdown,
      updatedAt: result.rows[0].updated_at,
      message: 'Release notes updated successfully',
    });
  } catch (error) {
    console.error('[release-notes.update] unexpected error:', error);
    sendError(res, 500, 'release_notes_update_failed', 'Unable to update release notes');
  }
}
