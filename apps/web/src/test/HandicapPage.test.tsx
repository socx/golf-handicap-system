import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import HandicapPage from '../pages/HandicapPage';

const authState = {
  user: { role: 'player', player_id: 'player-1' },
};

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

describe('HandicapPage', () => {
  it('redirects linked player users to their handicap history route', async () => {
    render(
      <MemoryRouter initialEntries={['/handicap']}>
        <Routes>
          <Route path="/handicap" element={<HandicapPage />} />
          <Route path="/handicap/history/:playerId" element={<div>Handicap History Route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Handicap History Route')).toBeInTheDocument();
  });
});
