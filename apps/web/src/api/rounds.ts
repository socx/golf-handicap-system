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
  round: RoundSummary;
  teeConfiguration: RoundDetailTeeConfiguration;
  holeScores: CreateRoundResponse['holeScores'];
}

export const roundsApi = {
  create: (payload: CreateRoundPayload) =>
    api.post<CreateRoundResponse>('/rounds', payload),
  get: (roundId: string) => api.get<RoundDetailResponse>(`/rounds/${roundId}`),
};
