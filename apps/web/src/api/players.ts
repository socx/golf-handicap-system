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

export const playersApi = {
  search: async (search: string, limit = 10): Promise<Player[]> => {
    const params = new URLSearchParams({ search, limit: String(limit) });
    const response = await api.get<PlayersListResponse>(`/players?${params}`);
    return response.data.players;
  },
};
