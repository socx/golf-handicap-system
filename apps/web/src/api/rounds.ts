export interface RoundListItem extends RoundSummary {
  playerFirstName: string;
  playerLastName: string;
  courseId: string;
  courseName: string;
  teeConfigurationName: string;
  teeColour: string;
}

export interface RoundsListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface RoundsListResponse {
  rounds: RoundListItem[];
  pagination: RoundsListPagination;
}

export interface RoundsListFilters {
  page?: number;
  limit?: number;
  playerId?: string;
  courseId?: string;
  teeConfigurationId?: string;
  from?: string;
  to?: string;
}
import { api } from './client';

export interface HoleScoreInput {
  holeNumber: number;
  strokes: number;
  putts: number | null;
  gir: boolean;
  fairwayHit: boolean | null;
  inSand: boolean;
  penalties: number;
}

export interface CreateRoundPayload {
  playerId: string;
  teeConfigurationId: string;
  playedAt: string;
  playingHandicap?: number | null;
  holeScores: HoleScoreInput[];
}

export interface RoundSummary {
  id: string;
  playerId: string;
  teeConfigurationId: string;
  playedAt: string;
  playingHandicap: number | null;
  status?: string;
  rejectionReason?: string | null;
  pcc?: number | null;
  grossScore: number;
  adjustedGrossScore: number;
  scoreDifferential: number | null;
  totals: {
    putts: number;
    gir: number;
    fairwaysHit: number;
    penalties: number;
  };
  flags: {
    isTournament: boolean;
    is9Hole: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RoundSummaryWithPlayer extends RoundSummary {
  playerFirstName: string;
  playerLastName: string;
}

export interface CreateRoundResponse {
  round: RoundSummary;
  holeScores: Array<{
    id: string;
    roundId: string;
    holeNumber: number;
    strokes: number;
    putts: number | null;
    gir: boolean;
    fairwayHit: boolean | null;
    inSand: boolean;
    penalties: number;
    netDoubleBogeyAdjusted: number;
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface RoundDetailTeeConfiguration {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  teeColour: string;
  holeCount: number;
  courseRating: number | null;
  slopeRating: number | null;
}

export interface RoundDetailResponse {
  round: RoundSummaryWithPlayer;
  teeConfiguration: RoundDetailTeeConfiguration;
  holeScores: CreateRoundResponse['holeScores'];
}

export interface RoundModerationResponse {
  message: string;
  round: {
    id: string;
    playerId: string;
    teeConfigurationId: string;
    playedAt: string;
    status: string;
    rejectionReason: string | null;
  };
  handicapRecalculationRequested: boolean;
  handicapRecalculation?: {
    attempted: boolean;
    status: string;
    reason?: string;
    handicapIndex?: number;
    recordId?: string;
  };
}

export const roundsApi = {
  create: (payload: CreateRoundPayload) =>
    api.post<CreateRoundResponse>('/rounds', payload),
  update: (roundId: string, payload: CreateRoundPayload) =>
    api.patch<CreateRoundResponse>(`/rounds/${roundId}`, payload),
  get: (roundId: string) => api.get<RoundDetailResponse>(`/rounds/${roundId}`),
  list: (filters: RoundsListFilters = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(filters.page ?? 1));
    params.set('limit', String(filters.limit ?? 10));
    if (filters.playerId) params.set('playerId', filters.playerId);
    if (filters.courseId) params.set('courseId', filters.courseId);
    if (filters.teeConfigurationId) params.set('teeConfigurationId', filters.teeConfigurationId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    return api.get<RoundsListResponse>(`/rounds?${params.toString()}`);
  },
  approve: (roundId: string) => api.post<RoundModerationResponse>(`/admin/rounds/${roundId}/approve`),
  reject: (roundId: string, rejectionReason: string) =>
    api.post<RoundModerationResponse>(`/admin/rounds/${roundId}/reject`, { rejectionReason }),
};
