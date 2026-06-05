// @vitest-environment jsdom

import './setup';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { roundsApi } from '../api/rounds';
import { playersApi } from '../api/players';
import RoundEntryPage from '../pages/RoundEntryPage';

type AuthStateUser = {
  role: 'admin' | 'player' | 'viewer';
  player_id: string | null;
};

// Mock auth hook
const authState = vi.hoisted(() => ({
  user: { role: 'admin', player_id: null } as AuthStateUser,
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: authState.user }),
}));

// Mock the selector components so tests don't need API calls for player/course/tee lookups.
// Each mock exposes a data-testid the test can use to simulate selection.
vi.mock('../components/ui/PlayerSelector', () => ({
  PlayerSelector: ({ onChange, label, disabled }: { onChange: (p: unknown) => void; label?: string; disabled?: boolean }) => (
    <button
      type="button"
      data-testid="player-selector"
      aria-label={label ?? 'Player'}
      disabled={disabled}
      onClick={() =>
        onChange({ id: 'player-1', givenName: 'Alice', familyName: 'Smith', email: 'a@example.com', handicapIndex: 10 })
      }
    >
      Select Player
    </button>
  ),
}));

vi.mock('../components/ui/CourseSelector', () => ({
  CourseSelector: ({ onChange, label }: { onChange: (c: unknown) => void; label?: string }) => (
    <button
      type="button"
      data-testid="course-selector"
      aria-label={label ?? 'Course'}
      onClick={() =>
        onChange({ id: 'course-1', name: 'Royal Glen' })
      }
    >
      Select Course
    </button>
  ),
}));

vi.mock('../components/ui/TeeConfigurationSelector', () => ({
  TeeConfigurationSelector: ({ onChange, label }: { onChange: (t: unknown) => void; label?: string }) => (
    <button
      type="button"
      data-testid="tee-selector"
      aria-label={label ?? 'Tee configuration'}
      onClick={() =>
        onChange({ id: 'tee-1', name: 'Blue', hole_count: 9 })
      }
    >
      Select Tee
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  authState.user = { role: 'admin', player_id: null };
});

function renderPage() {
  const rendered = render(
    <MemoryRouter initialEntries={['/rounds/new']}>
      <Routes>
        <Route path="/rounds/new" element={<RoundEntryPage />} />
        <Route path="/rounds" element={<div>Rounds list</div>} />
        <Route path="/rounds/:roundId" element={<div>Scorecard route</div>} />
      </Routes>
    </MemoryRouter>,
  );

  const dateInput = rendered.container.querySelector('input[type="date"]') as HTMLInputElement | null;
  return { ...rendered, dateInput };
}

describe('RoundEntryPage', () => {
  it('renders the form with player, course and tee selectors', () => {
    const { dateInput } = renderPage();

    expect(screen.getByRole('heading', { name: 'Enter Round' })).toBeInTheDocument();
    expect(screen.getByTestId('player-selector')).toBeInTheDocument();
    expect(screen.getByTestId('course-selector')).toBeInTheDocument();
    expect(screen.getByTestId('tee-selector')).toBeInTheDocument();
    expect(dateInput).not.toBeNull();
  });

  it('shows a per-hole grid with 18 rows by default', () => {
    renderPage();

    // Default hole count before tee config is selected is 18
    const table = screen.getByRole('table', { name: 'Hole scores grid' });
    expect(table).toBeInTheDocument();

    const strokeInputs = screen.getAllByLabelText(/strokes/i);
    expect(strokeInputs).toHaveLength(18);
  });

  it('rebuilds hole grid to 9 holes when a 9-hole tee config is selected', async () => {
    renderPage();

    fireEvent.click(screen.getByTestId('tee-selector'));

    await waitFor(() => {
      const strokeInputs = screen.getAllByLabelText(/strokes/i);
      expect(strokeInputs).toHaveLength(9);
    });
  });

  it('shows validation errors when submitting with no player or tee config', async () => {
    renderPage();

    fireEvent.click(screen.getAllByRole('button', { name: 'Save round' })[0]);

    expect(await screen.findByRole('alert', { name: 'Validation errors' })).toBeInTheDocument();
    expect(screen.getByText('Player is required.')).toBeInTheDocument();
    expect(screen.getByText('Tee configuration is required.')).toBeInTheDocument();
    expect(screen.getByText('Date played is required.')).toBeInTheDocument();
  });

  it('shows validation errors for holes with 0 strokes', async () => {
    const { dateInput } = renderPage();

    fireEvent.click(screen.getByTestId('player-selector'));
    fireEvent.click(screen.getByTestId('course-selector'));
    fireEvent.click(screen.getByTestId('tee-selector'));
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput!, { target: { value: '2025-06-01' } });

    // Leave all strokes at 0 and submit
    fireEvent.click(screen.getAllByRole('button', { name: 'Save round' })[0]);

    expect(await screen.findByRole('alert', { name: 'Validation errors' })).toBeInTheDocument();
    expect(screen.getByText('Hole 1: strokes must be at least 1.')).toBeInTheDocument();
  });

  it('calls roundsApi.create with the correct payload and redirects on success', async () => {
    const createSpy = vi.spyOn(roundsApi, 'create').mockResolvedValue({
      data: {
        round: {
          id: 'round-99',
          playerId: 'player-1',
          teeConfigurationId: 'tee-1',
          playedAt: '2025-06-01T00:00:00.000Z',
          playingHandicap: null,
          grossScore: 36,
          adjustedGrossScore: 36,
          scoreDifferential: null,
          totals: { putts: 0, gir: 0, fairwaysHit: 0, penalties: 0 },
          flags: { isTournament: false, is9Hole: true },
          createdAt: '2025-06-01T00:00:00.000Z',
          updatedAt: '2025-06-01T00:00:00.000Z',
        },
        holeScores: [],
      },
    } as never);

    const { dateInput } = renderPage();

    fireEvent.click(screen.getByTestId('player-selector'));
    fireEvent.click(screen.getByTestId('course-selector'));
    fireEvent.click(screen.getByTestId('tee-selector'));
    expect(dateInput).not.toBeNull();
    fireEvent.change(dateInput!, { target: { value: '2025-06-01' } });

    // Fill in strokes for all 9 holes
    const strokeInputs = screen.getAllByLabelText(/strokes/i);
    strokeInputs.forEach((input) => {
      fireEvent.change(input, { target: { value: '4' } });
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Save round' })[0]);

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: 'player-1',
        teeConfigurationId: 'tee-1',
      }),
    );

    expect(await screen.findByText('Scorecard route')).toBeInTheDocument();
  });

  it('navigates back to /rounds when Cancel is clicked', async () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Rounds list')).toBeInTheDocument();
  });

  it('preselects and disables player field for player users', async () => {
    authState.user = { role: 'player', player_id: 'player-self' };

    vi.spyOn(playersApi, 'get').mockResolvedValue({
      player: {
        id: 'player-self',
        first_name: 'John',
        last_name: 'Player',
        middle_name: null,
        dob: null,
        gender: null,
        email: 'john@example.com',
        club: 'My Club',
        country: 'GB',
        handicap_index: 12.5,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
      handicap_summary: {
        current_handicap_index: 12.5,
        last_handicap_update_date: null,
      },
      round_stats: {
        round_count: 0,
        last_round_date: null,
      },
    } as never);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Your account is scoped to your own player record.')).toBeInTheDocument();
    });

    const playerSelectorButton = screen.getByTestId('player-selector');
    expect(playerSelectorButton).toHaveAttribute('disabled');
  });
});
