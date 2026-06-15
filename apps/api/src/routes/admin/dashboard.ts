import http from 'node:http';
import { sendError, sendJson } from '../../lib/http';
import { verifyAndAuthorize } from '../../middleware/auth';
import {
  getAdminOverviewMetrics,
  getHandicapDistribution,
  getRecentActivity,
} from '../../services/analytics';

export async function handleGetAdminDashboard(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const authResult = verifyAndAuthorize(req, { requiredRoles: ['admin'] });
  if (!authResult.success || !authResult.auth) {
    sendError(res, authResult.statusCode || 401, authResult.errorCode || 'unauthorized', authResult.errorMessage || 'Unauthorized');
    return;
  }

  try {
    const [overview, handicapDistribution, recentActivity] = await Promise.all([
      getAdminOverviewMetrics(),
      getHandicapDistribution(),
      getRecentActivity(20),
    ]);

    sendJson(res, 200, {
      overview,
      handicapDistribution: {
        averageHandicapIndex: overview.averageHandicapIndex,
        buckets: handicapDistribution,
      },
      recentActivity,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[admin.dashboard] unexpected error:', error);
    sendError(res, 500, 'admin_dashboard_failed', 'Unable to retrieve admin dashboard metrics');
  }
}
