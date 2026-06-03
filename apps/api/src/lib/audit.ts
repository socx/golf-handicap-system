import { dbPool } from './db';

export type AuthAuditEventType =
  | 'auth_login_success'
  | 'auth_login_failure'
  | 'auth_logout'
  | 'auth_refresh'
  | 'auth_user_activated'
  | 'auth_user_deactivated'
  | 'auth_user_deleted'
  | 'auth_user_role_updated'
  | 'auth_password_reset_requested'
  | 'auth_password_reset_completed'
  | 'admin_access_allowed'
  | 'admin_access_denied'
  | 'player_user_linked'
  | 'player_user_unlinked'
  | 'player_deleted'
  | 'course_created'
  | 'course_updated'
  | 'course_deleted'
  | 'tee_configuration_created'
  | 'tee_configuration_updated'
  | 'tee_configuration_deleted';

export async function logAuthAuditEvent({
  requestId,
  event,
  userId,
  actorUserId,
  ipAddress,
  metadata,
}: {
  requestId: string;
  event: AuthAuditEventType;
  userId?: string | null;
  actorUserId?: string | null;
  ipAddress: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const safeMetadata = metadata || {};

  try {
    await dbPool.query(
      `INSERT INTO audit_logs (event_type, user_id, actor_user_id, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [event, userId || null, actorUserId || null, ipAddress, JSON.stringify(safeMetadata)],
    );
  } catch (error) {
    console.warn('[audit] failed to persist auth audit event:', (error as Error).message);
  }

  console.log(
    JSON.stringify({
      level: 'info',
      event,
      service: 'ghs-api',
      requestId,
      userId: userId || null,
      actorUserId: actorUserId || null,
      ipAddress,
      metadata: safeMetadata,
      timestamp: new Date().toISOString(),
    }),
  );
}

export async function logApplicationEvent({
  requestId,
  event,
  ipAddress,
  metadata,
  userId,
  actorUserId,
}: {
  requestId: string;
  event: string;
  ipAddress: string;
  metadata?: Record<string, unknown>;
  userId?: string | null;
  actorUserId?: string | null;
}): Promise<void> {
  const safeMetadata = metadata || {};

  try {
    await dbPool.query(
      `INSERT INTO audit_logs (event_type, user_id, actor_user_id, ip_address, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [event, userId || null, actorUserId || null, ipAddress, JSON.stringify(safeMetadata)],
    );
  } catch (error) {
    console.warn('[audit] failed to persist application event:', (error as Error).message);
  }

  console.log(
    JSON.stringify({
      level: 'warn',
      event,
      service: 'ghs-api',
      requestId,
      userId: userId || null,
      actorUserId: actorUserId || null,
      ipAddress,
      metadata: safeMetadata,
      timestamp: new Date().toISOString(),
    }),
  );
}
