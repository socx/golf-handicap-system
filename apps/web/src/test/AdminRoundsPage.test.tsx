// @vitest-environment jsdom

import './setup';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { coursesApi } from '../api/courses';
import { roundsApi } from '../api/rounds';
import AdminRoundsPage from '../pages/AdminRoundsPage';

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

function round(id: string, status: string, playedAt = '2026-05-26T00:00:00.000Z') {
  return {
    id,
    playerId: 'player-1',
    playerFirstName: 'John',
    playerLastName: 'Smith',
    teeConfigurationId: 'tee-1',
    courseId: 'course-1',
    courseName: 'Royal Glen',
    teeConfigurationName: 'Blue',
    teeColour: 'Blue',
    playedAt,
    playingHandicap: 12,
    status,
    rejectionReason: status === 'rejected' ? 'Invalid card' : null,
    grossScore: 76,
    adjustedGrossScore: 72,
    scoreDifferential: 8.4,
    pcc: null,
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
    <MemoryRouter initialEntries={['/admin/rounds']}>
      <Routes>
        <Route path="/admin/rounds" element={<AdminRoundsPage />} />
        <Route path="/rounds/:roundId" element={<div>Scorecard route</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminRoundsPage', () => {
  it('renders rounds, applies filters, and navigates to the scorecard', async () => {
    const listSpy = vi.spyOn(roundsApi, 'list').mockResolvedValue({
      data: {
        rounds: [round('round-1', 'pending'), round('round-2', 'approved', '2026-05-25T00:00:00.000Z')],
        pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
      },
    } as never);
    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      data: { data: [course], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as never);
    vi.spyOn(coursesApi, 'get').mockResolvedValue({ data: { ...course, tee_configurations: [teeConfiguration] } } as never);

    const rendered = renderPage();

    await waitFor(() => expect(listSpy).toHaveBeenCalled());
    expect(screen.getAllByText('John Smith').length).toBeGreaterThan(0);

    const courseSelect = rendered.container.querySelector('select[name="courseId"]') as HTMLSelectElement;
    const teeSelect = rendered.container.querySelector('select[name="teeConfigurationId"]') as HTMLSelectElement;
    const statusSelect = rendered.container.querySelector('select[name="status"]') as HTMLSelectElement;

    fireEvent.change(courseSelect, { target: { value: 'course-1' } });
    await waitFor(() => expect(coursesApi.get).toHaveBeenCalledWith('course-1'));
    fireEvent.change(teeSelect, { target: { value: 'tee-1' } });

    await waitFor(() => {
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 10,
          courseId: 'course-1',
          teeConfigurationId: 'tee-1',
        }),
      );
    });

    fireEvent.change(statusSelect, { target: { value: 'approved' } });
    expect(screen.queryByText('pending')).not.toBeInTheDocument();
    expect(screen.getAllByText('approved').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('John Smith')[0]);
    expect(await screen.findByText('Scorecard route')).toBeInTheDocument();
  });

  it('approves a round from the table', async () => {
    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      data: { data: [course], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as never);
    vi.spyOn(roundsApi, 'list').mockResolvedValue({
      data: {
        rounds: [round('round-1', 'pending')],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    } as never);
    const approveSpy = vi.spyOn(roundsApi, 'approve').mockResolvedValue({
      data: {
        message: 'Round approved',
        round: {
          id: 'round-1',
          playerId: 'player-1',
          teeConfigurationId: 'tee-1',
          playedAt: '2026-05-26T00:00:00.000Z',
          status: 'approved',
          rejectionReason: null,
        },
        handicapRecalculationRequested: true,
      },
    } as never);

    renderPage();

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Approve' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: 'Approve' })[0]);

    await waitFor(() => expect(approveSpy).toHaveBeenCalledWith('round-1'));
    expect(screen.getAllByText('approved').length).toBeGreaterThan(0);
  });

  it('opens the rejection modal and submits a rejection reason', async () => {
    vi.spyOn(coursesApi, 'list').mockResolvedValue({
      data: { data: [course], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as never);
    vi.spyOn(roundsApi, 'list').mockResolvedValue({
      data: {
        rounds: [round('round-1', 'pending')],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    } as never);
    const rejectSpy = vi.spyOn(roundsApi, 'reject').mockResolvedValue({
      data: {
        message: 'Round rejected',
        round: {
          id: 'round-1',
          playerId: 'player-1',
          teeConfigurationId: 'tee-1',
          playedAt: '2026-05-26T00:00:00.000Z',
          status: 'rejected',
          rejectionReason: 'Missing marker signature',
        },
        handicapRecalculationRequested: true,
      },
    } as never);

    renderPage();

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Reject' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]);

    const input = screen.getByRole('textbox', { name: 'Rejection reason' });
    fireEvent.change(input, { target: { value: 'Missing marker signature' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }));

    await waitFor(() => expect(rejectSpy).toHaveBeenCalledWith('round-1', 'Missing marker signature'));
    expect(screen.getByText('Missing marker signature')).toBeInTheDocument();
    expect(screen.getAllByText('rejected').length).toBeGreaterThan(0);
  });
});