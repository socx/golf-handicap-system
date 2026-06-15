import { api } from './client';

export interface DashboardRecentRound {
  id: string;
  playedAt: string;
  courseName: string | null;
  grossScore: number;
  adjustedGrossScore: number;
  status: 'pending' | 'approved' | 'rejected';
}

export interface DashboardTrendPoint {
  id: string;
  calculationDate: string;
  handicapIndex: number;
  roundsUsed: string[];
}

export interface DashboardStats {
  girPercentage: number;
  firPercentage: number;
  averagePutts: number;
  averagePenalties: number;
  scoringAverages: {
    front9: number | null;
    back9: number | null;
    overall: number | null;
  };
}

export interface DashboardSummaryResponse {
  playerId: string;
  recentRounds: DashboardRecentRound[];
  currentHandicapIndex: number | null;
  handicapTrend: DashboardTrendPoint[];
  stats: DashboardStats;
  generatedAt: string;
}

export async function getDashboardSummary(playerId?: string): Promise<DashboardSummaryResponse> {
  const params = new URLSearchParams();
  if (playerId) params.set('playerId', playerId);
  const path = params.toString() ? `/dashboard?${params.toString()}` : '/dashboard';
  const response = await api.get<DashboardSummaryResponse>(path);
  return response.data;
}
