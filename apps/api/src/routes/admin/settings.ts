import http from 'node:http';
import { dbPool } from '../../lib/db';
import { getClientIp, readJsonBody, sendError, sendJson } from '../../lib/http';
import { logApplicationEvent } from '../../lib/audit';
import { verifyAndAuthorize } from '../../middleware/auth';

interface NotificationSettings {
  round_submitted: boolean;
  round_approved: boolean;
  maintenance_alerts: boolean;
}

interface SystemSettingsRow {
  pcc_override: number | null;
  notification_settings: NotificationSettings;
  maintenance_mode: boolean;
  updated_at: string;
}

const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  round_submitted: true,
  round_approved: true,
  maintenance_alerts: true,
};

function normalizeNotificationSettings(value: unknown): NotificationSettings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;

  const result: NotificationSettings = {
    round_submitted:
      typeof input.round_submitted === 'boolean' ? input.round_submitted : DEFAULT_NOTIFICATION_SETTINGS.round_submitted,
    round_approved:
      typeof input.round_approved === 'boolean' ? input.round_approved : DEFAULT_NOTIFICATION_SETTINGS.round_approved,
    maintenance_alerts:
      typeof input.maintenance_alerts === 'boolean' ? input.maintenance_alerts : DEFAULT_NOTIFICATION_SETTINGS.maintenance_alerts,
  };

  return result;
}

async function ensureSettingsRow(): Promise<void> {
  await dbPool.query('INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
}

export async function handleGetAdminSettings(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  try {
    await ensureSettingsRow();

    const result = await dbPool.query<SystemSettingsRow>(
      `SELECT pcc_override, notification_settings, maintenance_mode, updated_at
       FROM system_settings
       WHERE id = 1`,
    );

    const row = result.rows[0];
    sendJson(res, 200, {
      settings: {
        pccOverride: row.pcc_override,
        notificationSettings: row.notification_settings,
        maintenanceMode: row.maintenance_mode,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error('[admin.settings.get] unexpected error:', error);
    sendError(res, 500, 'settings_read_failed', 'Unable to load system settings');
  }
}

export async function handleUpdateAdminSettings(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  requestId: string,
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

  const hasPccOverride = Object.prototype.hasOwnProperty.call(payload, 'pccOverride');
  const hasNotificationSettings = Object.prototype.hasOwnProperty.call(payload, 'notificationSettings');
  const hasMaintenanceMode = Object.prototype.hasOwnProperty.call(payload, 'maintenanceMode');

  if (!hasPccOverride && !hasNotificationSettings && !hasMaintenanceMode) {
    sendError(res, 400, 'validation_error', 'At least one setting field must be provided');
    return;
  }

  let nextPccOverride: number | null | undefined;
  if (hasPccOverride) {
    const raw = payload.pccOverride;
    if (raw === null || raw === '') {
      nextPccOverride = null;
    } else if (typeof raw === 'number' && Number.isInteger(raw) && raw >= -1 && raw <= 3) {
      nextPccOverride = raw;
    } else {
      sendError(res, 400, 'validation_error', 'pccOverride must be null or an integer between -1 and 3');
      return;
    }
  }

  let nextNotificationSettings: NotificationSettings | undefined;
  if (hasNotificationSettings) {
    const normalized = normalizeNotificationSettings(payload.notificationSettings);
    if (!normalized) {
      sendError(res, 400, 'validation_error', 'notificationSettings must be an object');
      return;
    }
    nextNotificationSettings = normalized;
  }

  let nextMaintenanceMode: boolean | undefined;
  if (hasMaintenanceMode) {
    if (typeof payload.maintenanceMode !== 'boolean') {
      sendError(res, 400, 'validation_error', 'maintenanceMode must be a boolean');
      return;
    }
    nextMaintenanceMode = payload.maintenanceMode;
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO system_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');

    const currentResult = await client.query<SystemSettingsRow>(
      `SELECT pcc_override, notification_settings, maintenance_mode, updated_at
       FROM system_settings
       WHERE id = 1
       FOR UPDATE`,
    );

    const current = currentResult.rows[0];
    const mergedNotificationSettings = nextNotificationSettings ?? current.notification_settings;
    const mergedPccOverride = hasPccOverride ? (nextPccOverride ?? null) : current.pcc_override;
    const mergedMaintenanceMode = hasMaintenanceMode ? Boolean(nextMaintenanceMode) : current.maintenance_mode;

    const updateResult = await client.query<SystemSettingsRow>(
      `UPDATE system_settings
       SET pcc_override = $1,
           notification_settings = $2::jsonb,
           maintenance_mode = $3,
           updated_by = $4,
           updated_at = NOW()
       WHERE id = 1
       RETURNING pcc_override, notification_settings, maintenance_mode, updated_at`,
      [mergedPccOverride, JSON.stringify(mergedNotificationSettings), mergedMaintenanceMode, authResult.auth.userId],
    );

    await client.query('COMMIT');

    const updated = updateResult.rows[0];

    await logApplicationEvent({
      requestId,
      event: 'admin_system_settings_updated',
      ipAddress: getClientIp(req),
      actorUserId: authResult.auth.userId,
      metadata: {
        previous: {
          pccOverride: current.pcc_override,
          notificationSettings: current.notification_settings,
          maintenanceMode: current.maintenance_mode,
        },
        current: {
          pccOverride: updated.pcc_override,
          notificationSettings: updated.notification_settings,
          maintenanceMode: updated.maintenance_mode,
        },
      },
    });

    sendJson(res, 200, {
      settings: {
        pccOverride: updated.pcc_override,
        notificationSettings: updated.notification_settings,
        maintenanceMode: updated.maintenance_mode,
        updatedAt: updated.updated_at,
      },
      message: 'System settings updated successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[admin.settings.update] unexpected error:', error);
    sendError(res, 500, 'settings_update_failed', 'Unable to update system settings');
  } finally {
    client.release();
  }
}
