// @vitest-environment jsdom

import './setup';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { roundsApi } from '../api/rounds';
import RoundScorecardPage from '../pages/RoundScorecardPage';

const roundResponse = {
  round: {
    id: 'round-1',
    playerId: 'player-1',
    teeConfigurationId: 'tee-1',
    playedAt: '2026-05-26T00:00:00.000Z',
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
      is9Hole: true,
    },
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
  },
  teeConfiguration: {
    id: 'tee-1',
    courseId: 'course-1',
    courseName: 'Royal Glen',
    name: 'Blue',
    teeColour: 'Blue',
    holeCount: 9,
    courseRating: 71.2,
    slopeRating: 127,
  },
  holeScores: Array.from({ length: 9 }, (_, index) => ({
    id: `hole-${index + 1}`,
    roundId: 'round-1',
    holeNumber: index + 1,
    strokes: 4 + (index % 2),
    putts: index % 3,
    gir: index % 2 === 0,
    fairwayHit: index % 4 === 0 ? null : index % 3 === 0,
    inSand: index % 5 === 0,
    penalties: index % 2,
    netDoubleBogeyAdjusted: 4 + (index % 2),
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
  })),
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/rounds/round-1']}>
      <Routes>
        <Route path="/rounds/:roundId" element={<RoundScorecardPage />} />
        <Route path="/rounds" element={<div>Rounds list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoundScorecardPage', () => {
  it('renders round details, totals, tee metadata and the hole grid', async () => {
    vi.spyOn(roundsApi, 'get').mockResolvedValue({ data: roundResponse } as never);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'round-1' })).toBeInTheDocument();
    expect(screen.getByTestId('tee-name')).toHaveTextContent('Blue');
    expect(screen.getByTestId('tee-colour')).toHaveTextContent('Blue');
    expect(screen.getByText('Royal Glen')).toBeInTheDocument();
    expect(screen.getByTestId('gross-score')).toHaveTextContent('76');
    expect(screen.getByTestId('adjusted-score')).toHaveTextContent('72');
    expect(screen.getByTestId('putts-total')).toHaveTextContent('31');
    expect(screen.getByTestId('gir-total')).toHaveTextContent('10');
    expect(screen.getByTestId('fir-total')).toHaveTextContent('7');
    expect(screen.getByTestId('penalties-total')).toHaveTextContent('2');

    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(screen.getByLabelText('Mobile scorecard grid')).toHaveClass('md:hidden');
    expect(screen.getByLabelText('Desktop scorecard grid')).toHaveClass('hidden', 'md:block');
    expect(screen.getAllByText(/Hole [1-9]/)).toHaveLength(9);
  });

  it('surfaces an error when the round cannot be fetched', async () => {
    vi.spyOn(roundsApi, 'get').mockRejectedValue(new Error('Round not found'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Round not found');
    });
  });
});
