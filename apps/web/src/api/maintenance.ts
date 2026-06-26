import { api } from './client';

export interface MaintenanceStatusResponse {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt: string | null;
}

export const maintenanceApi = {
  getStatus: () => api.get<MaintenanceStatusResponse>('/maintenance'),
};
