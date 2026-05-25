import { api } from './client';

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  club: string | null;
  country: string;
  handicap_index: number | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayersListResponse {
  players: Player[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface RawPlayersListResponse {
  players?: Player[];
  data?: Player[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    pages?: number;
  };
}

export function normalizePlayersListResponse(payload: unknown): PlayersListResponse {
  const raw = (payload ?? {}) as RawPlayersListResponse;
  const rawPagination = raw.pagination ?? {};

  return {
    players: Array.isArray(raw.players) ? raw.players : Array.isArray(raw.data) ? raw.data : [],
    pagination: {
      page: rawPagination.page ?? 1,
      limit: rawPagination.limit ?? 10,
      total: rawPagination.total ?? 0,
      totalPages: rawPagination.totalPages ?? rawPagination.pages ?? 1,
    },
  };
}

export const playersApi = {
  search: async (search: string, limit = 10): Promise<Player[]> => {
    const params = new URLSearchParams({ search, limit: String(limit) });
    const response = await api.get<unknown>(`/players?${params}`);
    return normalizePlayersListResponse(response.data).players;
  },
};
