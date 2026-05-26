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

export const roundsApi = {
  create: (payload: CreateRoundPayload) =>
    api.post<CreateRoundResponse>('/rounds', payload),
};
