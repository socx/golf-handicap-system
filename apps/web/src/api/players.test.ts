import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';
import { normalizePlayersListResponse, playersApi } from './players';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizePlayersListResponse', () => {
  it('supports payload with players and totalPages', () => {
    const normalized = normalizePlayersListResponse({
      players: [{ id: '1', first_name: 'Mia', last_name: 'Turner' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    expect(normalized.players).toHaveLength(1);
    expect(normalized.players[0]?.id).toBe('1');
    expect(normalized.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('supports payload with data and pages', () => {
    const normalized = normalizePlayersListResponse({
      data: [{ id: '2', first_name: 'Noah', last_name: 'Patel' }],
      pagination: { page: 2, limit: 10, total: 15, pages: 2 },
    });

    expect(normalized.players).toHaveLength(1);
    expect(normalized.players[0]?.id).toBe('2');
    expect(normalized.pagination).toEqual({ page: 2, limit: 10, total: 15, totalPages: 2 });
  });
});

describe('playersApi.search', () => {
  it('returns normalized players for backend payload compatibility', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        data: [{ id: '3', first_name: 'Ava', last_name: 'Brooks' }],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 },
      },
    } as never);

    const players = await playersApi.search('ava');

    expect(players).toHaveLength(1);
    expect(players[0]?.id).toBe('3');
  });
});

describe('playersApi.list', () => {
  it('builds query params and returns normalized list payload', async () => {
    const getSpy = vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        data: [{ id: '4', first_name: 'Leo', last_name: 'Nguyen' }],
        pagination: { page: 2, limit: 10, total: 11, pages: 2 },
      },
    } as never);

    const result = await playersApi.list({ page: 2, limit: 10, search: 'leo', club: 'City Club', country: 'US' });

    expect(getSpy).toHaveBeenCalledWith('/players?page=2&limit=10&search=leo&club=City+Club&country=US');
    expect(result.players).toHaveLength(1);
    expect(result.players[0]?.id).toBe('4');
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 11, totalPages: 2 });
  });
});

describe('playersApi mutations', () => {
  it('delete calls the player delete endpoint', async () => {
    const deleteSpy = vi.spyOn(api, 'delete').mockResolvedValue({} as never);

    await playersApi.delete('player-123');

    expect(deleteSpy).toHaveBeenCalledWith('/players/player-123');
  });

  it('linkUser calls link-user endpoint and returns updated player', async () => {
    const patchSpy = vi.spyOn(api, 'patch').mockResolvedValue({
      data: {
        player: {
          id: 'player-123',
          first_name: 'Mia',
          last_name: 'Turner',
          middle_name: null,
          dob: null,
          gender: null,
          club: null,
          country: 'US',
          handicap_index: 12.2,
          email: 'mia@example.com',
          user_id: '11111111-1111-4111-8111-111111111111',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      },
    } as never);

    const result = await playersApi.linkUser('player-123', '11111111-1111-4111-8111-111111111111');

    expect(patchSpy).toHaveBeenCalledWith('/players/player-123/link-user', {
      user_id: '11111111-1111-4111-8111-111111111111',
    });
    expect(result.user_id).toBe('11111111-1111-4111-8111-111111111111');
  });
});
