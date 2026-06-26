import { api } from './client';

export interface ReleaseNotesResponse {
  markdown: string;
  updatedAt: string | null;
}

export const releaseNotesApi = {
  get: () => api.get<ReleaseNotesResponse>('/release-notes'),
  update: (markdown: string) =>
    api.patch<ReleaseNotesResponse & { message: string }>('/admin/release-notes', { markdown }),
};
