// @vitest-environment jsdom

import './setup';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as handicapApi from '../api/handicap';
import { playersApi } from '../api/players';
import AdminHandicapOverridePage from '../pages/AdminHandicapOverridePage';

const player = {
  id: 'player-1',
  first_name: 'Alice',
  last_name: 'Webb',
  middle_name: null,
  dob: null,
  gender: null,
  club: null,
  country: 'GB',
  handicap_index: 18.0,
  email: null,
  user_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const overrideEntry = {
  id: 'override-1',
  playerId: 'player-1',
  adminUserId: 'admin-1',
  adminEmail: 'admin@example.com',
  previousIndex: 18.0,
  newIndex: 14.3,
  reason: 'WHS exceptional reduction',
  createdAt: '2026-06-05T10:00:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/handicap-override/player-1']}>
      <Routes>
        <Route path="/admin/handicap-override/:playerId" element={<AdminHandicapOverridePage />} />
        <Route path="/players/:playerId" element={<div>Player profile</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminHandicapOverridePage', () => {
  it('loads player and existing overrides, renders history table', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue({
      player,
      handicap_summary: { current_handicap_index: 18.0, last_handicap_update_date: null },
      round_stats: { round_count: 0, last_round_date: null },
    } as never);
    vi.spyOn(handicapApi, 'listHandicapOverrides').mockResolvedValue({
      playerId: 'player-1',
      total: 1,
      overrides: [overrideEntry],
    });

    renderPage();

    await waitFor(() => expect(screen.getByTestId('current-index')).toHaveTextContent('18.0'));
    expect(screen.getByText('WHS exceptional reduction')).toBeInTheDocument();
    expect(screen.getByText('14.3')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('submits the form and refreshes the history', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue({
      player,
      handicap_summary: { current_handicap_index: 18.0, last_handicap_update_date: null },
      round_stats: { round_count: 0, last_round_date: null },
    } as never);
    const listSpy = vi.spyOn(handicapApi, 'listHandicapOverrides').mockResolvedValue({
      playerId: 'player-1',
      total: 0,
      overrides: [],
    });
    const createSpy = vi.spyOn(handicapApi, 'createHandicapOverride').mockResolvedValue({
      message: 'Handicap override applied',
      override: {
        playerId: 'player-1',
        adminUserId: 'admin-1',
        previousIndex: 18.0,
        newIndex: 14.3,
        reason: 'Test reason',
      },
    });

    renderPage();


    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply override' })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('New handicap index'), { target: { value: '14.3' } });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Test reason' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply override' }));

    await waitFor(() =>
      expect(createSpy).toHaveBeenCalledWith('player-1', { newIndex: 14.3, reason: 'Test reason' }),
    );
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('shows a validation error when the form is submitted without a reason', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue({
      player,
      handicap_summary: { current_handicap_index: 18.0, last_handicap_update_date: null },
      round_stats: { round_count: 0, last_round_date: null },
    } as never);
    vi.spyOn(handicapApi, 'listHandicapOverrides').mockResolvedValue({
      playerId: 'player-1',
      total: 0,
      overrides: [],
    });

    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply override' })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('New handicap index'), { target: { value: '14.3' } });
    // leave reason blank
    fireEvent.click(screen.getByRole('button', { name: 'Apply override' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Reason is required.');
  });
});
