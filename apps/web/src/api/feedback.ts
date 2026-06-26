import { api } from './client';

export type FeedbackCategory = 'bug' | 'feature' | 'ui' | 'other';

export interface FeedbackItem {
  id: string;
  user_id: string;
  user_email?: string;
  category: FeedbackCategory;
  message: string;
  screenshot_data_url: string | null;
  status: 'open' | 'reviewed' | 'resolved';
  created_at: string;
  updated_at: string;
}

export const feedbackApi = {
  submit: (payload: { category: FeedbackCategory; message: string; screenshotDataUrl?: string | null }) =>
    api.post<{ feedback: FeedbackItem; message: string }>('/feedback', payload),

  listAdmin: (params?: { page?: number; limit?: number; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.page) search.set('page', String(params.page));
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.status) search.set('status', params.status);
    const query = search.toString();
    return api.get<{ feedback: FeedbackItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      query ? `/admin/feedback?${query}` : '/admin/feedback',
    );
  },
};
