import { api } from './client';

export interface HealthModuleStatus {
  status: 'ok' | 'degraded';
  details: Record<string, unknown>;
}

export interface AdminSystemHealthResponse {
  status: 'ok' | 'degraded';
  modules: {
    database: HealthModuleStatus;
    cache: HealthModuleStatus;
    objectStorage: HealthModuleStatus;
    queue: HealthModuleStatus;
  };
  api: {
    uptimeSeconds: number;
    startedAt: string;
  };
  checkedAt: string;
}

export const adminSystemHealthApi = {
  get: () => api.get<AdminSystemHealthResponse>('/admin/system-health'),
};
