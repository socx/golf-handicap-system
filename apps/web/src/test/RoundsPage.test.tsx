// @vitest-environment jsdom

import './setup';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import RoundsPage from '../pages/RoundsPage';

afterEach(() => {
  cleanup();
});

describe('RoundsPage responsive scorecard layout', () => {
  it('renders a mobile scorecard list and desktop scorecard table containers', () => {
    render(
      <MemoryRouter>
        <RoundsPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('Mobile scorecard list')).toHaveClass('md:hidden');
    expect(screen.getByLabelText('Desktop scorecard table')).toHaveClass('hidden', 'md:block');
  });

  it('uses a responsive filter form and keeps tables horizontally scrollable', () => {
    render(
      <MemoryRouter>
        <RoundsPage />
      </MemoryRouter>,
    );

    const filterForm = screen.getByLabelText('Round filters form');
    expect(filterForm).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');

    const table = screen.getByRole('table');
    expect(table.parentElement).toHaveClass('overflow-x-auto');
  });
});
