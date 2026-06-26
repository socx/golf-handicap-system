import http from 'node:http';
import { dbPool } from '../../lib/db';
import { sendError, sendJson } from '../../lib/http';
import { verifyAndAuthorize } from '../../middleware/auth';
import { recalculateHandicapForPlayer } from '../handicap';

interface BatchRecalculationProgress {
  jobId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  totalPlayers: number;
  processedPlayers: number;
  successfulRecalculations: number;
  failedRecalculations: number;
  errors: Array<{ playerId: string; error: string }>;
  startedAt: string;
  completedAt: string | null;
  estimatedTimeRemaining: number | null;
}

// In-memory job tracking (in production, this would be in Redis or a database)
const batchJobs = new Map<string, BatchRecalculationProgress>();

function generateJobId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateTimeRemaining(
  processedPlayers: number,
  totalPlayers: number,
  elapsed: number,
): number | null {
  if (processedPlayers === 0) return null;
  const avgTimePerPlayer = elapsed / processedPlayers;
  return Math.ceil((totalPlayers - processedPlayers) * avgTimePerPlayer);
}

export async function handleRecalculateAllHandicaps(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  try {
    // Get all active players (not deleted)
    const playersResult = await dbPool.query<{ id: string }>(
      'SELECT id FROM players WHERE deleted_at IS NULL ORDER BY created_at',
    );

    const playerIds = playersResult.rows.map((row) => String(row.id));
    const jobId = generateJobId();

    // Initialize job tracking
    const job: BatchRecalculationProgress = {
      jobId,
      status: 'started',
      totalPlayers: playerIds.length,
      processedPlayers: 0,
      successfulRecalculations: 0,
      failedRecalculations: 0,
      errors: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      estimatedTimeRemaining: null,
    };

    batchJobs.set(jobId, job);

    // Return job ID immediately
    sendJson(res, 202, {
      jobId,
      status: 'started',
      totalPlayers: playerIds.length,
      message: `Batch recalculation job started. You can track progress using /admin/batch/jobs/${jobId}`,
    });

    // Process in background (without blocking the response)
    setImmediate(async () => {
      const startTime = Date.now();

      for (const playerId of playerIds) {
        try {
          const result = await recalculateHandicapForPlayer(playerId, { sendNotifications: false });

          job.processedPlayers += 1;

          if (result.status === 'eligible' || result.status === 'insufficient_holes') {
            job.successfulRecalculations += 1;
          } else {
            job.failedRecalculations += 1;
          }

          // Update estimated time remaining
          const elapsed = Date.now() - startTime;
          job.estimatedTimeRemaining = calculateTimeRemaining(job.processedPlayers, job.totalPlayers, elapsed);

          // Log progress every 10 players or at the end
          if (job.processedPlayers % 10 === 0 || job.processedPlayers === job.totalPlayers) {
            console.log(
              `[batch.recalculate] Progress: ${job.processedPlayers}/${job.totalPlayers} players processed, ` +
                `${job.successfulRecalculations} successful, ${job.failedRecalculations} failed`,
            );
          }
        } catch (error) {
          job.processedPlayers += 1;
          job.failedRecalculations += 1;

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          job.errors.push({
            playerId,
            error: errorMessage,
          });

          console.error(`[batch.recalculate] Error recalculating handicap for player ${playerId}:`, error);
        }
      }

      // Mark job as completed
      job.status = 'completed';
      job.completedAt = new Date().toISOString();
      job.estimatedTimeRemaining = null;

      console.log(
        `[batch.recalculate] Batch job ${jobId} completed: ` +
          `${job.successfulRecalculations}/${job.totalPlayers} successful, ` +
          `${job.failedRecalculations} failed`,
      );
    });
  } catch (error) {
    console.error('[batch.recalculate] unexpected error:', error);
    sendError(res, 500, 'batch_recalculation_failed', 'Unable to start batch recalculation job');
  }
}

export async function handleGetBatchJobStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  jobId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const job = batchJobs.get(jobId);
  if (!job) {
    sendError(res, 404, 'job_not_found', `Batch job ${jobId} not found`);
    return;
  }

  sendJson(res, 200, {
    jobId: job.jobId,
    status: job.status,
    totalPlayers: job.totalPlayers,
    processedPlayers: job.processedPlayers,
    successfulRecalculations: job.successfulRecalculations,
    failedRecalculations: job.failedRecalculations,
    progressPercent: job.totalPlayers > 0 ? Math.round((job.processedPlayers / job.totalPlayers) * 100) : 0,
    estimatedTimeRemaining: job.estimatedTimeRemaining, // in milliseconds
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    errors: job.errors.length > 0 ? job.errors : undefined,
  });
}

export async function handleListBatchJobs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  const jobs = Array.from(batchJobs.values()).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  sendJson(res, 200, {
    total: jobs.length,
    jobs: jobs.map((job) => ({
      jobId: job.jobId,
      status: job.status,
      totalPlayers: job.totalPlayers,
      processedPlayers: job.processedPlayers,
      progressPercent: job.totalPlayers > 0 ? Math.round((job.processedPlayers / job.totalPlayers) * 100) : 0,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    })),
  });
}
