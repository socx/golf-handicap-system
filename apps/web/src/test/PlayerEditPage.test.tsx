import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { playersApi } from '../api/players';
import PlayerEditPage from '../pages/PlayerEditPage';

const mockPlayer = {
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
  updated_at: '2026-01-01T00:00:00.000Z',
};

const mockPlayerDetail = {
  player: mockPlayer,
  handicap_summary: {
    current_handicap_index: mockPlayer.handicap_index,
    last_handicap_update_date: null,
  },
  round_stats: {
    round_count: 0,
    last_round_date: null,
  },
};

function renderEditPage(playerId = 'player-1') {
  return render(
    <MemoryRouter initialEntries={[`/players/${playerId}/edit`]}>
      <Routes>
        <Route path="/players/:playerId/edit" element={<PlayerEditPage />} />
        <Route path="/players" element={<div>Players list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlayerEditPage', () => {
  it('loads player data and populates form fields', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue(mockPlayerDetail);

    renderEditPage();

    expect(await screen.findByDisplayValue('Ava')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Clark')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ava@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('GB')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lakeside GC')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12.4')).toBeInTheDocument();
  });

  it('shows validation errors for required fields when submitting empty values', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue(mockPlayerDetail);

    renderEditPage();

    await screen.findByDisplayValue('Ava');

    // Clear required fields
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/country/i), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('First name is required.')).toBeInTheDocument();
    expect(screen.getByText('Last name is required.')).toBeInTheDocument();
    expect(screen.getByText('Country is required.')).toBeInTheDocument();
  });

  it('submits PATCH and redirects to /players on success', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue(mockPlayerDetail);
    const updateSpy = vi.spyOn(playersApi, 'update').mockResolvedValue({ ...mockPlayer, first_name: 'Updated' });

    renderEditPage();

    await screen.findByDisplayValue('Ava');

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        'player-1',
        expect.objectContaining({ first_name: 'Updated' }),
      );
    });

    expect(await screen.findByText('Players list')).toBeInTheDocument();
  });

  it('shows server error message when update fails', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue(mockPlayerDetail);
    vi.spyOn(playersApi, 'update').mockRejectedValue(new Error('Duplicate email'));

    renderEditPage();

    await screen.findByDisplayValue('Ava');

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Duplicate email')).toBeInTheDocument();
  });

  it('navigates back to /players when Cancel is clicked', async () => {
    vi.spyOn(playersApi, 'get').mockResolvedValue(mockPlayerDetail);

    renderEditPage();

    await screen.findByDisplayValue('Ava');

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(await screen.findByText('Players list')).toBeInTheDocument();
  });
});
