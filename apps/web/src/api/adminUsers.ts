import { api } from './client';

export interface AdminUser {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'player' | 'viewer';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AdminUsersListResponse {
  users: AdminUser[];
  total: number;
  includeDeleted: boolean;
  filters: {
    search: string;
    role: string;
    status: 'active' | 'inactive' | null;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  message: string;
}

export interface AdminUsersListParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: 'active' | 'inactive';
  includeDeleted?: boolean;
}

export interface AdminUserActivationResponse {
  user: AdminUser;
  notificationEmailSent: boolean;
  message: string;
}

function toQueryString(params: AdminUsersListParams): string {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);
  if (params.includeDeleted) query.set('includeDeleted', 'true');
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const adminUsersApi = {
  list: (params: AdminUsersListParams = {}) =>
    api.get<AdminUsersListResponse>(`/admin/users${toQueryString(params)}`),
  activate: (userId: string) =>
    api.patch<AdminUserActivationResponse>(`/users/${userId}/activate`),
  deactivate: (userId: string) =>
    api.patch<AdminUserActivationResponse>(`/users/${userId}/deactivate`),
};
