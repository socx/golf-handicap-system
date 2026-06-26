import http from 'node:http';
import { dbPool } from '../lib/db';
import { sendJson } from '../lib/http';

interface MaintenanceSettingsRow {
  maintenance_mode: boolean;
  maintenance_message: string;
  updated_at: string;
}

const DEFAULT_MAINTENANCE_MESSAGE = 'Scheduled maintenance is in progress. Some features may be temporarily unavailable.';

export async function handleGetMaintenanceStatus(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  try {
    await dbPool.query('INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');

    const result = await dbPool.query<MaintenanceSettingsRow>(
      `SELECT maintenance_mode, maintenance_message, updated_at
       FROM system_settings
       WHERE id = 1`,
    );

    const row = result.rows[0];
    sendJson(res, 200, {
      maintenanceMode: Boolean(row?.maintenance_mode),
      maintenanceMessage: row?.maintenance_message || DEFAULT_MAINTENANCE_MESSAGE,
      updatedAt: row?.updated_at || null,
    });
  } catch (error) {
    console.error('[maintenance.get] unexpected error:', error);
    sendJson(res, 200, {
      maintenanceMode: false,
      maintenanceMessage: DEFAULT_MAINTENANCE_MESSAGE,
      updatedAt: null,
    });
  }
}
