import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'admin@club.local', role: 'admin' },
    logout: vi.fn(async () => {}),
  }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    toggleTheme: vi.fn(),
  }),
}));

describe('AppLayout mobile navigation', () => {
  it('collapses sidebar by default and opens as a drawer when toggled', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="dashboard" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const sidebar = screen.getByText('Navigation').closest('aside');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass('-translate-x-full');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation' }));

    expect(sidebar).toHaveClass('translate-x-0');
    expect(screen.getByRole('button', { name: 'Close navigation' })).toBeInTheDocument();
  });
});
