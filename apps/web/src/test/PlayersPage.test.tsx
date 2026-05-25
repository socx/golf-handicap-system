import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { playersApi } from '../api/players';
import PlayersPage from '../pages/PlayersPage';

describe('PlayersPage', () => {
  it('renders paginated players and navigates to player profile route', async () => {
    const listSpy = vi.spyOn(playersApi, 'list').mockResolvedValue({
      players: [
        {
          id: 'player-1',
          first_name: 'Mia',
          last_name: 'Turner',
          middle_name: null,
          club: 'Harbor Golf Club',
          country: 'GB',
          handicap_index: 8.2,
          email: 'mia@example.com',
          created_at: '2026-05-25T00:00:00.000Z',
          updated_at: '2026-05-25T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 2,
      },
    });

    render(
      <MemoryRouter initialEntries={['/players']}>
        <Routes>
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/:playerId" element={<div>Player detail route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Mia Turner');
    expect(listSpy).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      search: undefined,
      club: undefined,
      country: undefined,
    });

    fireEvent.click(screen.getByRole('button', { name: 'View Profile' }));
    expect(await screen.findByText('Player detail route')).toBeInTheDocument();
  });

  it('applies search and club/country filters in API calls', async () => {
    const listSpy = vi.spyOn(playersApi, 'list').mockResolvedValue({
      players: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      },
    });

    render(
      <MemoryRouter initialEntries={['/players']}>
        <Routes>
          <Route path="/players" element={<PlayersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByPlaceholderText('Search by name or email...'), { target: { value: 'ava' } });
    fireEvent.change(screen.getByPlaceholderText('Filter by club...'), { target: { value: 'North Club' } });
    fireEvent.change(screen.getByPlaceholderText('Filter by country...'), { target: { value: 'gb' } });

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith({
        page: 1,
        limit: 10,
        search: 'ava',
        club: 'North Club',
        country: 'GB',
      });
    });
  });

  it('keeps focus in filter input while typing', async () => {
    vi.spyOn(playersApi, 'list').mockResolvedValue({
      players: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      },
    });

    render(
      <MemoryRouter initialEntries={['/players']}>
        <Routes>
          <Route path="/players" element={<PlayersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const filterInput = await screen.findByPlaceholderText('Filter by club...');
    filterInput.focus();
    expect(filterInput).toHaveFocus();

    fireEvent.change(filterInput, { target: { value: 'N' } });
    await waitFor(() => {
      expect(filterInput).toHaveFocus();
    });
  });
});