import { api } from './client';

export interface Player {
  id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  dob: string | null;
  gender: string | null;
  club: string | null;
  country: string;
  handicap_index: number | null;
  email: string | null;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlayerDetail {
  player: Player;
  handicap_summary: {
    current_handicap_index: number | string | null;
    last_handicap_update_date: string | null;
  };
  round_stats: {
    round_count: number;
    last_round_date: string | null;
  };
}

export interface PlayerUpdatePayload {
  first_name?: string;
  last_name?: string;
  middle_name?: string | null;
  dob?: string | null;
  gender?: string | null;
  club?: string | null;
  email?: string | null;
  country?: string;
  handicap_index?: number | null;
}

export interface PlayerCreatePayload {
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  dob?: string | null;
  gender?: string | null;
  club?: string | null;
  email?: string | null;
  country: string;
  handicap_index?: number | null;
  user_id?: string | null;
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

export interface PlayersListQuery {
  page?: number;
  limit?: number;
  search?: string;
  club?: string;
  country?: string;
}

export interface PlayerImportIssue {
  field: string;
  message: string;
}

export interface PlayerImportRow {
  rowNumber: number;
  values: {
    first_name: string;
    last_name: string;
    dob: string | null;
    gender: string | null;
    club: string | null;
    country: string;
    email: string | null;
  };
  issues: PlayerImportIssue[];
}

export interface PlayerImportResponse {
  dryRun: boolean;
  summary: {
    rowCount: number;
    validRows?: number;
    invalidRows?: number;
    totalIssues?: number;
    importedRows?: number;
  };
  rows?: PlayerImportRow[];
  players?: Player[];
}

export interface BackgroundImportResponse {
  queued: true;
  jobId: string;
  rowCount: number;
  adminEmail: string;
  message: string;
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
  get: async (playerId: string): Promise<PlayerDetail> => {
    const response = await api.get<{
      player: Player;
      handicap_summary?: {
        current_handicap_index?: number | string | null;
        last_handicap_update_date?: string | null;
      };
      round_stats?: {
        round_count?: number;
        last_round_date?: string | null;
      };
    }>(`/players/${playerId}`);

    return {
      player: response.data.player,
      handicap_summary: {
        current_handicap_index: response.data.handicap_summary?.current_handicap_index ?? response.data.player.handicap_index ?? null,
        last_handicap_update_date: response.data.handicap_summary?.last_handicap_update_date ?? null,
      },
      round_stats: {
        round_count: response.data.round_stats?.round_count ?? 0,
        last_round_date: response.data.round_stats?.last_round_date ?? null,
      },
    };
  },
  update: async (playerId: string, payload: PlayerUpdatePayload): Promise<Player> => {
    const response = await api.patch<{ player: Player }>(`/players/${playerId}`, payload);
    return response.data.player;
  },
  create: async (payload: PlayerCreatePayload): Promise<Player> => {
    const response = await api.post<{ player: Player }>('/players', payload);
    return response.data.player;
  },
  list: async (query: PlayersListQuery = {}): Promise<PlayersListResponse> => {
    const params = new URLSearchParams();

    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    if (query.club) params.set('club', query.club);
    if (query.country) params.set('country', query.country);

    const queryString = params.toString();
    const response = await api.get<unknown>(queryString ? `/players?${queryString}` : '/players');
    return normalizePlayersListResponse(response.data);
  },
  search: async (search: string, limit = 10): Promise<Player[]> => {
    const params = new URLSearchParams({ search, limit: String(limit) });
    const response = await api.get<unknown>(`/players?${params}`);
    return normalizePlayersListResponse(response.data).players;
  },
  delete: async (playerId: string): Promise<void> => {
    await api.delete(`/players/${playerId}`);
  },
  linkUser: async (playerId: string, userId: string | null): Promise<Player> => {
    const response = await api.patch<{ player: Player }>(`/players/${playerId}/link-user`, { user_id: userId });
    return response.data.player;
  },
  importCsv: async (csvText: string, dryRun: boolean): Promise<PlayerImportResponse | BackgroundImportResponse> => {
    const response = await api.post<PlayerImportResponse | BackgroundImportResponse>('/players/import', { csvText, dryRun });
    return response.data;
  },
};
