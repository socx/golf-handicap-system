import { api } from './client';

export interface HandicapCalculationResponse {
  playerId: string;
  eligibilityStatus: 'eligible' | 'insufficient_holes' | 'insufficient_rounds';
  currentIndex: number;
  handicapIndex: number;
  lowHandicapIndex: number;
  totalEligibleHoles: number;
  minimumRequiredHoles: number;
  roundsConsidered: number;
  calculatedAt: string;
  recordId: string;
}

export interface HandicapRecord {
  id: string;
  calculationDate: string;
  handicapIndex: number;
  numDifferentials: number;
  averageDifferential: number;
  differentialsUsed: unknown;
  roundsUsed: string[];
  pccValues: unknown;
  capAdjustments: unknown;
  createdAt: string;
}

export interface HandicapHistoryResponse {
  playerId: string;
  total: number;
  records: HandicapRecord[];
}

export interface HandicapEligibilityResponse {
  playerId: string;
  eligibilityStatus: 'eligible' | 'insufficient_holes';
  totalEligibleHoles: number;
  minimumRequiredHoles: number;
}

export async function getHandicapEligibility(
  playerId: string
): Promise<HandicapEligibilityResponse> {
  const response = await api.get<HandicapEligibilityResponse>(
    `/handicap/eligibility/${playerId}`
  );
  return response.data;
}

export async function getHandicapHistory(
  playerId: string,
  options?: { from?: string; to?: string }
): Promise<HandicapHistoryResponse> {
  const params = new URLSearchParams();
  if (options?.from) params.append('from', options.from);
  if (options?.to) params.append('to', options.to);
  
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await api.get<HandicapHistoryResponse>(
    `/handicap/history/${playerId}${query}`
  );
  return response.data;
}

export async function calculateHandicap(
  playerId: string
): Promise<HandicapCalculationResponse> {
  const response = await api.post<HandicapCalculationResponse>(
    `/handicap/calculate/${playerId}`,
    {}
  );
  return response.data;
}
