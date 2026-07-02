import http from 'node:http';
import { sendError, sendJson } from '../../lib/http';
import { verifyAndAuthorize } from '../../middleware/auth';
import { getImportJob, listImportJobs } from '../../lib/importJobs';

export async function handleGetImportJob(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  jobId: string,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(
      res,
      authResult.statusCode || 401,
      authResult.errorCode || 'unauthorized',
      authResult.errorMessage || 'Unauthorized',
    );
    return;
  }

  const job = getImportJob(jobId);
  if (!job) {
    sendError(res, 404, 'not_found', `Import job ${jobId} not found`);
    return;
  }

  sendJson(res, 200, {
    ...job,
    progressPercent:
      job.totalRows > 0 ? Math.round((job.processedRows / job.totalRows) * 100) : 0,
  });
}

export async function handleListImportJobs(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(
      res,
      authResult.statusCode || 401,
      authResult.errorCode || 'unauthorized',
      authResult.errorMessage || 'Unauthorized',
    );
    return;
  }

  const jobs = listImportJobs();
  sendJson(res, 200, { jobs, total: jobs.length });
}
