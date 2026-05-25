import { render, screen } from '@testing-library/react';
import RoundsPage from '../pages/RoundsPage';

describe('RoundsPage responsive scorecard layout', () => {
  it('renders a mobile scorecard list and desktop scorecard table containers', () => {
    render(<RoundsPage />);

    expect(screen.getByLabelText('Mobile scorecard list')).toHaveClass('md:hidden');
    expect(screen.getByLabelText('Desktop scorecard table')).toHaveClass('hidden', 'md:block');
  });

  it('uses a responsive filter form and keeps tables horizontally scrollable', () => {
    render(<RoundsPage />);

    const filterForm = screen.getByLabelText('Round filters form');
    expect(filterForm).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-4');

    const table = screen.getByRole('table');
    expect(table.parentElement).toHaveClass('overflow-x-auto');
  });
});
