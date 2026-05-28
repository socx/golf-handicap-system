import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HandicapSummaryWidget } from '../components/HandicapSummaryWidget';
import * as handicapApi from '../api/handicap';

describe('HandicapSummaryWidget', () => {
  it('renders loading state initially', () => {
    vi.spyOn(handicapApi, 'getHandicapEligibility').mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );
    vi.spyOn(handicapApi, 'getHandicapHistory').mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(<HandicapSummaryWidget playerId="player-1" />);

    expect(screen.getByText('Handicap Summary')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders handicap index when player is eligible', async () => {
    const mockEligibility = {
      playerId: 'player-1',
      eligibilityStatus: 'eligible' as const,
      totalEligibleHoles: 54,
      minimumRequiredHoles: 54,
    };

    const mockHistory = {
      playerId: 'player-1',
      total: 1,
      records: [
        {
          id: 'calc-1',
          calculationDate: '2026-01-15',
          handicapIndex: 8.5,
          numDifferentials: 8,
          averageDifferential: 6.2,
          differentialsUsed: [],
          roundsUsed: ['round-1', 'round-2', 'round-3', 'round-4', 'round-5', 'round-6', 'round-7', 'round-8'],
          pccValues: {},
          capAdjustments: {},
          createdAt: '2026-01-15T10:00:00.000Z',
        },
      ],
    };

    vi.spyOn(handicapApi, 'getHandicapEligibility').mockResolvedValue(mockEligibility);
    vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue(mockHistory);

    render(
      <MemoryRouter>
        <HandicapSummaryWidget playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('8.5')).toBeInTheDocument();
    });

    expect(screen.getByText(/Updated:/)).toBeInTheDocument();
    expect(screen.getByText(/View History/)).toBeInTheDocument();
  });

  it('renders insufficient holes message when player is not eligible', async () => {
    const mockEligibility = {
      playerId: 'player-1',
      eligibilityStatus: 'insufficient_holes' as const,
      totalEligibleHoles: 27,
      minimumRequiredHoles: 54,
    };

    const mockHistory = {
      playerId: 'player-1',
      total: 0,
      records: [],
    };

    vi.spyOn(handicapApi, 'getHandicapEligibility').mockResolvedValue(mockEligibility);
    vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue(mockHistory);

    render(
      <MemoryRouter>
        <HandicapSummaryWidget playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Insufficient holes/)).toBeInTheDocument();
    });

    expect(screen.getByText(/27 more holes needed/)).toBeInTheDocument();
  });

  it('renders error message when API call fails', async () => {
    vi.spyOn(handicapApi, 'getHandicapEligibility').mockRejectedValue(new Error('API error'));
    vi.spyOn(handicapApi, 'getHandicapHistory').mockRejectedValue(new Error('API error'));

    render(
      <MemoryRouter>
        <HandicapSummaryWidget playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/API error/)).toBeInTheDocument();
    });
  });

  it('includes link to handicap history page', async () => {
    const mockEligibility = {
      playerId: 'player-1',
      eligibilityStatus: 'eligible' as const,
      totalEligibleHoles: 54,
      minimumRequiredHoles: 54,
    };

    const mockHistory = {
      playerId: 'player-1',
      total: 1,
      records: [
        {
          id: 'calc-1',
          calculationDate: '2026-01-15',
          handicapIndex: 8.5,
          numDifferentials: 8,
          averageDifferential: 6.2,
          differentialsUsed: [],
          roundsUsed: ['round-1', 'round-2', 'round-3', 'round-4', 'round-5', 'round-6', 'round-7', 'round-8'],
          pccValues: {},
          capAdjustments: {},
          createdAt: '2026-01-15T10:00:00.000Z',
        },
      ],
    };

    vi.spyOn(handicapApi, 'getHandicapEligibility').mockResolvedValue(mockEligibility);
    vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue(mockHistory);

    render(
      <MemoryRouter>
        <HandicapSummaryWidget playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /View History/ });
      expect(link).toHaveAttribute('href', '/handicap/history/player-1');
    });
  });

  it('refetches data when playerId prop changes', async () => {
    const mockEligibility = {
      playerId: 'player-1',
      eligibilityStatus: 'eligible' as const,
      totalEligibleHoles: 54,
      minimumRequiredHoles: 54,
    };

    const mockHistory = {
      playerId: 'player-1',
      total: 0,
      records: [],
    };

    const getEligibilitySpy = vi.spyOn(handicapApi, 'getHandicapEligibility').mockResolvedValue(mockEligibility);
    const getHistorySpy = vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue(mockHistory);

    const { rerender } = render(
      <MemoryRouter>
        <HandicapSummaryWidget playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getEligibilitySpy).toHaveBeenCalledWith('player-1');
    });

    // Reset call count
    getEligibilitySpy.mockClear();
    getHistorySpy.mockClear();

    // Change playerId
    rerender(
      <MemoryRouter>
        <HandicapSummaryWidget playerId="player-2" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getEligibilitySpy).toHaveBeenCalledWith('player-2');
      expect(getHistorySpy).toHaveBeenCalledWith('player-2');
    });
  });
});
