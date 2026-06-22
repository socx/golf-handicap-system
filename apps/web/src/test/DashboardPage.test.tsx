// @vitest-environment jsdom

import './setup';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDashboardSummary } from '../api/dashboard';
import DashboardPage from '../pages/DashboardPage';

const authState = vi.hoisted(() => ({
  user: { role: 'player', player_id: 'player-1' as string | null },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../components/HandicapSummaryWidget', () => ({
  HandicapSummaryWidget: ({ playerId }: { playerId: string }) => (
    <div data-testid="handicap-widget">Handicap widget {playerId}</div>
  ),
}));

vi.mock('../api/dashboard', () => ({
  getDashboardSummary: vi.fn(),
}));

const mockedGetDashboardSummary = vi.mocked(getDashboardSummary);

describe('DashboardPage', () => {
  beforeEach(() => {
    mockedGetDashboardSummary.mockReset();
    authState.user = { role: 'player', player_id: 'player-1' };
  });

  it('renders dashboard widgets with analytics data', async () => {
    mockedGetDashboardSummary.mockResolvedValue({
      playerId: 'player-1',
      currentHandicapIndex: 9.8,
      generatedAt: '2026-05-01T00:00:00.000Z',
      recentRounds: [
        {
          id: 'round-1',
          playedAt: '2026-05-10T00:00:00.000Z',
          courseName: 'Royal Glen',
          grossScore: 78,
          adjustedGrossScore: 76,
          status: 'approved',
        },
      ],
      handicapTrend: [
        {
          id: 'trend-1',
          calculationDate: '2026-05-10T00:00:00.000Z',
          handicapIndex: 9.8,
          roundsUsed: ['r1', 'r2'],
        },
        {
          id: 'trend-2',
          calculationDate: '2026-04-10T00:00:00.000Z',
          handicapIndex: 10.3,
          roundsUsed: ['r1', 'r2', 'r3'],
        },
      ],
      stats: {
        girPercentage: 55.5,
        firPercentage: 60.1,
        averagePutts: 30.4,
        averagePenalties: 1.2,
        scoringAverages: {
          front9: 38.4,
          back9: 39.1,
          overall: 77.5,
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/rounds/:roundId" element={<div>Scorecard route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockedGetDashboardSummary).toHaveBeenCalledWith('player-1');
    });

    expect(screen.getByTestId('handicap-widget')).toBeInTheDocument();
    expect(screen.getByText('Royal Glen')).toBeInTheDocument();
    expect(screen.getByText('55.5%')).toBeInTheDocument();
    expect(screen.getByText('60.1%')).toBeInTheDocument();
    expect(screen.getByText('30.40')).toBeInTheDocument();
    expect(screen.getByText('1.20')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-trend-chart')).toBeInTheDocument();
    expect(screen.getByLabelText('Stats widget')).toBeInTheDocument();

    const roundLink = screen.getByRole('link', { name: /Royal Glen/i });
    expect(roundLink).toHaveAttribute('href', '/rounds/round-1');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-05-01' } });
    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('');
  });

  it('renders profile-linking guidance when user has no player profile', async () => {
    authState.user = { role: 'player', player_id: null };

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText('Dashboard analytics are available when your account is linked to a player profile.'),
    ).toBeInTheDocument();
    expect(mockedGetDashboardSummary).not.toHaveBeenCalled();
  });
});
