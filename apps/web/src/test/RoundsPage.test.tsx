// @vitest-environment jsdom

import './setup';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coursesApi } from '../api/courses';
import { roundsApi } from '../api/rounds';
import RoundsPage from '../pages/RoundsPage';

const authState = vi.hoisted(() => ({
  user: { role: 'admin' as 'admin' | 'player' | 'viewer' },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: authState.user }),
}));

beforeEach(() => {
  authState.user = { role: 'admin' };
});

const course = {
  id: 'course-1',
  name: 'Royal Glen',
  address: '1 Fairway Road',
  city: 'Edinburgh',
  country: 'GB',
  phone: null,
  email: null,
  website: null,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
  deleted_at: null,
  tee_configurations: [],
};

const teeConfiguration = {
  id: 'tee-1',
  course_id: 'course-1',
  name: 'Blue',
  tee_colour: 'Blue',
  hole_count: 18,
  course_rating: 71.2,
  slope_rating: 127,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
};

function round(id: string, playedAt: string, teeConfigurationId = 'tee-1') {
  return {
    id,
    playerId: 'player-1',
    playerFirstName: 'John',
    playerLastName: 'Smith',
    teeConfigurationId,
    courseId: 'course-1',
    courseName: 'Royal Glen',
    teeConfigurationName: 'Blue',
    teeColour: 'Blue',
    playedAt,
    playingHandicap: 12,
    grossScore: 76,
    adjustedGrossScore: 72,
    scoreDifferential: 8.4,
    totals: {
      putts: 31,
      gir: 10,
      fairwaysHit: 7,
      penalties: 2,
    },
    flags: {
      isTournament: false,
      is9Hole: false,
    },
    createdAt: playedAt,
    updatedAt: playedAt,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/rounds']}>
      <Routes>
        <Route path="/rounds" element={<RoundsPage />} />
        <Route path="/rounds/:roundId" element={<div>Scorecard route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoundsPage', () => {
  it('renders a paginated list and opens the scorecard when a round is clicked', async () => {
    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      data: { data: [course], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as never);
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: { ...course, tee_configurations: [teeConfiguration] } } as never);
    vi.spyOn(roundsApi, 'list').mockResolvedValue({
      data: {
        rounds: [round('round-1', '2026-05-26T00:00:00.000Z'), round('round-2', '2026-05-25T00:00:00.000Z')],
        pagination: { page: 1, limit: 10, total: 12, totalPages: 2 },
      },
    } as never);

    renderPage();

    await waitFor(() => expect(roundsApi.list).toHaveBeenCalled());
  expect(screen.getAllByText('John S. - 2026-05-26')[0]).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile round list')).toHaveClass('md:hidden');
    expect(screen.getByLabelText('Desktop round table')).toHaveClass('hidden', 'md:block');

  fireEvent.click(screen.getAllByText('John S. - 2026-05-26')[0]);

    expect(await screen.findByText('Scorecard route')).toBeInTheDocument();
  });

  it('requests filtered rounds when the filters change', async () => {
    const listSpy = vi.spyOn(roundsApi, 'list').mockResolvedValue({
      data: {
        rounds: [round('round-1', '2026-05-26T00:00:00.000Z')],
        pagination: { page: 1, limit: 10, total: 12, totalPages: 2 },
      },
    } as never);
    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      data: { data: [course], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as never);
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: { ...course, tee_configurations: [teeConfiguration] } } as never);

    const rendered = renderPage();

    await waitFor(() => expect(listSpy).toHaveBeenCalled());

    const courseSelect = rendered.container.querySelector('select[name="courseId"]') as HTMLSelectElement;
    const teeSelect = rendered.container.querySelector('select[name="teeConfigurationId"]') as HTMLSelectElement;
    const fromInput = rendered.container.querySelector('input[name="fromDate"]') as HTMLInputElement;
    const toInput = rendered.container.querySelector('input[name="toDate"]') as HTMLInputElement;

    fireEvent.change(courseSelect, { target: { value: 'course-1' } });
    await waitFor(() => expect(coursesApi.get).toHaveBeenCalledWith('course-1'));

    fireEvent.change(teeSelect, { target: { value: 'tee-1' } });
    fireEvent.change(fromInput, { target: { value: '2026-05-01' } });
    fireEvent.change(toInput, { target: { value: '2026-05-31' } });

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10,
          courseId: 'course-1',
          teeConfigurationId: 'tee-1',
          from: '2026-05-01',
          to: '2026-05-31',
        }),
      );
    });
  });

  it('advances pagination when the next page is selected', async () => {
    const listSpy = vi.spyOn(roundsApi, 'list').mockResolvedValue({
      data: {
        rounds: [round('round-1', '2026-05-26T00:00:00.000Z')],
        pagination: { page: 1, limit: 10, total: 12, totalPages: 2 },
      },
    } as never);
    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      data: { data: [course], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as never);
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: { ...course, tee_configurations: [teeConfiguration] } } as never);

    renderPage();

    await waitFor(() => expect(listSpy).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 10,
        }),
      );
    });
  });

  it('shows player-specific copy when role is player', async () => {
    authState.user = { role: 'player' };

    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      data: { data: [course], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as never);
    vi.spyOn(roundsApi, 'list').mockResolvedValue({
      data: {
        rounds: [round('round-1', '2026-05-26T00:00:00.000Z')],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    } as never);

    renderPage();

    expect(await screen.findByText('Browse your own rounds, filter by date range, and open your scorecards.')).toBeInTheDocument();
  });
});
