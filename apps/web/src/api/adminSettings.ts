import { api } from './client';

export interface AdminNotificationSettings {
  round_submitted: boolean;
  round_approved: boolean;
  maintenance_alerts: boolean;
}

export interface AdminSystemSettings {
  pccOverride: number | null;
  notificationSettings: AdminNotificationSettings;
  maintenanceMode: boolean;
  updatedAt: string;
}

export interface AdminSystemSettingsResponse {
  settings: AdminSystemSettings;
}

export interface UpdateAdminSystemSettingsPayload {
  pccOverride?: number | null;
  notificationSettings?: AdminNotificationSettings;
  maintenanceMode?: boolean;
}

export const adminSettingsApi = {
  get: () => api.get<AdminSystemSettingsResponse>('/admin/settings'),
  update: (payload: UpdateAdminSystemSettingsPayload) =>
    api.patch<AdminSystemSettingsResponse & { message: string }>('/admin/settings', payload),
};
