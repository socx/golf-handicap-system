import http from 'node:http';
import { dbPool } from '../../lib/db';
import { redisState } from '../../lib/redis';
import { sendError, sendJson } from '../../lib/http';
import { verifySuperAdminAndLog } from '../../middleware/auth';
import { getApiStartedAtMs, getApiUptimeSeconds } from '../../lib/runtime';

interface ModuleStatus {
  status: 'ok' | 'degraded';
  details: Record<string, unknown>;
}

function getObjectStorageStatus(): ModuleStatus {
  const endpoint = process.env.DO_SPACES_ENDPOINT || '';
  const accessKey = process.env.DO_SPACES_KEY || '';
  const secret = process.env.DO_SPACES_SECRET || '';
  const bucket = process.env.DO_SPACES_BUCKET || '';

  const configured = Boolean(endpoint && accessKey && secret && bucket);

  return {
    status: configured ? 'ok' : 'degraded',
    details: {
      configured,
      provider: configured ? 'digitalocean-spaces' : 'unconfigured',
      endpoint: endpoint || null,
      bucket: bucket || null,
    },
  };
}

function getQueueStatus(): ModuleStatus {
  const provider = process.env.JOB_QUEUE_PROVIDER || 'in_memory';
  const configured = provider !== 'disabled';

  return {
    status: configured ? 'ok' : 'degraded',
    details: {
      provider,
      configured,
      mode: provider === 'in_memory' ? 'process-local background jobs' : 'external queue',
    },
  };
}

export async function handleGetSystemHealth(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = await verifySuperAdminAndLog(req);
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  try {
    const dbStarted = Date.now();
    await dbPool.query('SELECT 1');
    const dbResponseTimeMs = Date.now() - dbStarted;

    const database: ModuleStatus = {
      status: !dbPool.ended ? 'ok' : 'degraded',
      details: {
        connected: !dbPool.ended,
        responseTimeMs: dbResponseTimeMs,
      },
    };

    const cache: ModuleStatus = {
      status: redisState.ready ? 'ok' : 'degraded',
      details: {
        provider: 'redis',
        ready: redisState.ready,
      },
    };

    const objectStorage = getObjectStorageStatus();
    const queue = getQueueStatus();

    const modules = {
      database,
      cache,
      objectStorage,
      queue,
    };

    const hasDegradedModule = Object.values(modules).some((module) => module.status !== 'ok');

    sendJson(res, 200, {
      status: hasDegradedModule ? 'degraded' : 'ok',
      modules,
      api: {
        uptimeSeconds: getApiUptimeSeconds(),
        startedAt: new Date(getApiStartedAtMs()).toISOString(),
      },
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[admin.system-health] unexpected error:', error);
    sendError(res, 500, 'system_health_failed', 'Unable to retrieve system health status');
  }
}
