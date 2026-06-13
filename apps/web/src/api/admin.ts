import { api } from './client';

export interface AuditLog {
  id: string;
  event_type: string;
  user_id: string | null;
  actor_user_id: string | null;
  ip_address: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  filters: {
    userId: string | null;
    eventType: string | null;
    from: string | null;
    to: string | null;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message: string;
}

export interface GetAuditLogsParams {
  page?: number;
  limit?: number;
  userId?: string;
  eventType?: string;
  from?: string;
  to?: string;
}

export const adminApi = {
  getAuditLogs: (params: GetAuditLogsParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.userId) searchParams.append('userId', params.userId);
    if (params.eventType) searchParams.append('eventType', params.eventType);
    if (params.from) searchParams.append('from', params.from);
    if (params.to) searchParams.append('to', params.to);

    const queryString = searchParams.toString();
    const url = queryString ? `/admin/audit-logs?${queryString}` : '/admin/audit-logs';
    return api.get<AuditLogsResponse>(url);
  },
};
