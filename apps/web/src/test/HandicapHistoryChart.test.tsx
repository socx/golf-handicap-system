import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HandicapHistoryChart } from '../components/HandicapHistoryChart';
import * as handicapApi from '../api/handicap';

const makeRecord = (overrides: Partial<{
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
}> = {}) => ({
  id: 'calc-1',
  calculationDate: '2026-01-15',
  handicapIndex: 8.5,
  numDifferentials: 8,
  averageDifferential: 6.2,
  differentialsUsed: [],
  roundsUsed: ['round-1', 'round-2', 'round-3', 'round-4', 'round-5'],
  pccValues: {},
  capAdjustments: {},
  createdAt: '2026-01-15T10:00:00.000Z',
  ...overrides,
});

describe('HandicapHistoryChart', () => {
  it('renders loading skeleton initially', () => {
    vi.spyOn(handicapApi, 'getHandicapHistory').mockImplementation(
      () => new Promise(() => {}),
    );

    render(
      <MemoryRouter>
        <HandicapHistoryChart playerId="player-1" />
      </MemoryRouter>,
    );

    expect(screen.getByText('Handicap History')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders chart when history data is returned', async () => {
    const mockHistory = {
      playerId: 'player-1',
      total: 2,
      records: [
        makeRecord({ id: 'calc-2', calculationDate: '2026-02-10', handicapIndex: 7.8 }),
        makeRecord({ id: 'calc-1', calculationDate: '2026-01-15', handicapIndex: 8.5 }),
      ],
    };

    vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue(mockHistory);

    render(
      <MemoryRouter>
        <HandicapHistoryChart playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });
  });

  it('renders empty state message when no history records', async () => {
    vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue({
      playerId: 'player-1',
      total: 0,
      records: [],
    });

    render(
      <MemoryRouter>
        <HandicapHistoryChart playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('No handicap history data available.')).toBeInTheDocument();
    });
  });

  it('renders error message when API call fails', async () => {
    vi.spyOn(handicapApi, 'getHandicapHistory').mockRejectedValue(
      new Error('Network error'),
    );

    render(
      <MemoryRouter>
        <HandicapHistoryChart playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument();
    });
  });

  it('renders date range filter inputs', async () => {
    vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue({
      playerId: 'player-1',
      total: 0,
      records: [],
    });

    render(
      <MemoryRouter>
        <HandicapHistoryChart playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
  });

  it('applies date range filter on form submit', async () => {
    const spy = vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue({
      playerId: 'player-1',
      total: 0,
      records: [],
    });

    render(
      <MemoryRouter>
        <HandicapHistoryChart playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-03-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
      const lastCall = spy.mock.calls[1];
      expect(lastCall[1]).toMatchObject({
        from: expect.stringContaining('2026-01-01'),
        to: expect.stringContaining('2026-03-31'),
      });
    });
  });

  it('shows Reset button only when a date filter is set', async () => {
    vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue({
      playerId: 'player-1',
      total: 0,
      records: [],
    });

    render(
      <MemoryRouter>
        <HandicapHistoryChart playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });

    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
  });

  it('resets filter and refetches on Reset click', async () => {
    const spy = vi.spyOn(handicapApi, 'getHandicapHistory').mockResolvedValue({
      playerId: 'player-1',
      total: 0,
      records: [],
    });

    render(
      <MemoryRouter>
        <HandicapHistoryChart playerId="player-1" />
      </MemoryRouter>,
    );

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => {
      expect(spy).toHaveBeenCalledTimes(2);
      const lastCall = spy.mock.calls[1];
      // After reset no date filters should be passed
      expect(lastCall[1]).toEqual({});
    });
  });
});
