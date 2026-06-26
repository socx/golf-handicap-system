import { api } from './client';

export interface GlobalSearchSuggestion {
  type: 'player' | 'round' | 'course';
  id: string;
  label: string;
  subtitle?: string;
  path: string;
}

export interface GlobalSearchResponse {
  query: string;
  suggestions: GlobalSearchSuggestion[];
}

export const searchApi = {
  global: async (query: string, limit = 8): Promise<GlobalSearchResponse> => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    const response = await api.get<GlobalSearchResponse>(`/search?${params.toString()}`);
    return response.data;
  },
};
