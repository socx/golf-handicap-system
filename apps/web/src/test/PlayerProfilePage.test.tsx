import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { playersApi } from '../api/players';
import PlayerProfilePage from '../pages/PlayerProfilePage';

vi.mock('../components/HandicapSummaryWidget', () => ({
  HandicapSummaryWidget: ({ playerId }: { playerId: string }) => (
    <div data-testid="handicap-summary-widget">Handicap Widget for {playerId}</div>
  ),
}));

const mockDetail = {
  player: {
    id: 'player-1',
    first_name: 'Ava',
    last_name: 'Clark',
    middle_name: null,
    dob: '1990-06-15',
    gender: 'female',
    club: 'Lakeside GC',
    email: 'ava@example.com',
    country: 'GB',
    handicap_index: 12.4,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
  },
  handicap_summary: {
    current_handicap_index: '11.1',
    last_handicap_update_date: '2026-05-21T08:00:00.000Z',
  },
  round_stats: {
    round_count: 18,
    last_round_date: '2026-05-20T08:00:00.000Z',
  },
};

function renderProfile(playerId = 'player-1') {
  return render(
    <MemoryRouter initialEntries={[`/players/${playerId}`]}>
      <Routes>
        <Route path="/players/:playerId" element={<PlayerProfilePage />} />
        <Route path="/players" element={<div>Players list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlayerProfilePage', () => {
  it('renders full profile, handicap summary stats, and round stats', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue(mockDetail);

    renderProfile();

    expect(await screen.findByText('Ava Clark')).toBeInTheDocument();
    expect(screen.getByText('Lakeside GC')).toBeInTheDocument();
    expect(screen.getByText('Current Handicap Index')).toBeInTheDocument();
    expect(screen.getByText('11.1')).toBeInTheDocument();
    expect(screen.getByText('Last Handicap Update')).toBeInTheDocument();
    expect(screen.getByText('Rounds Recorded')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Last Round Date')).toBeInTheDocument();
    expect(screen.getByTestId('handicap-summary-widget')).toHaveTextContent('player-1');
  });

  it('shows load error state', async () => {
    vi.spyOn(playersApi, 'get').mockRejectedValue(new Error('Player not found'));

    renderProfile();

    expect(await screen.findByText('Player not found')).toBeInTheDocument();
  });

  it('renders fallback values when detail stats are missing', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue({
      ...mockDetail,
      handicap_summary: {
        current_handicap_index: null,
        last_handicap_update_date: null,
      },
      round_stats: {
        round_count: 0,
        last_round_date: null,
      },
    });

    renderProfile();

    await screen.findByText('Ava Clark');

    expect(screen.getByText('Current Handicap Index')).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('calls playersApi.get with route player id', async () => {
    const getSpy = vi.spyOn(playersApi, 'get').mockResolvedValue(mockDetail);

    renderProfile('player-42');

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith('player-42');
    });
  });
});
