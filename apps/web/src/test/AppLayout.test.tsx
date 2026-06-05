import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout, { getFilteredNavigationItems } from '../components/layout/AppLayout';

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

describe('Navigation Filtering', () => {
  describe('getFilteredNavigationItems', () => {
    it('returns empty array for null role', () => {
      const items = getFilteredNavigationItems(null);
      expect(items).toEqual([]);
    });

    it('returns only admin items for admin role', () => {
      const items = getFilteredNavigationItems('admin');
      expect(items.length).toBeGreaterThan(0);
      const labels = items.map(i => i.label);
      expect(labels).toContain('Admin');
      expect(labels).toContain('Admin Settings');
    });

    it('does not include admin items for player role', () => {
      const items = getFilteredNavigationItems('player');
      const labels = items.map(i => i.label);
      expect(labels).not.toContain('Admin');
      expect(labels).not.toContain('Admin Settings');
    });

    it('returns correct items for player role', () => {
      const items = getFilteredNavigationItems('player');
      const labels = items.map(i => i.label);
      expect(labels).toContain('Dashboard');
      expect(labels).toContain('Players');
      expect(labels).toContain('Rounds');
      expect(labels).toContain('Handicap');
      expect(labels).toContain('Settings');
    });

    it('does not include admin items for viewer role', () => {
      const items = getFilteredNavigationItems('viewer');
      const labels = items.map(i => i.label);
      expect(labels).not.toContain('Admin');
      expect(labels).not.toContain('Admin Settings');
      expect(labels).not.toContain('Players');
      expect(labels).not.toContain('Rounds');
      expect(labels).not.toContain('Handicap');
    });

    it('returns only viewer-accessible items for viewer role', () => {
      const items = getFilteredNavigationItems('viewer');
      const labels = items.map(i => i.label);
      expect(labels).toContain('Dashboard');
      expect(labels).toContain('Courses');
      expect(labels).toContain('Settings');
    });

    it('all items for admin have admin in their roles', () => {
      const items = getFilteredNavigationItems('admin');
      items.forEach(item => {
        expect(item.roles).toContain('admin');
      });
    });

    it('all items for player do not include admin-only items', () => {
      const items = getFilteredNavigationItems('player');
      const adminOnlyItems = ['Admin', 'Admin Settings'];
      items.forEach(item => {
        expect(adminOnlyItems).not.toContain(item.label);
      });
    });

    it('admin should have more items than player', () => {
      const adminItems = getFilteredNavigationItems('admin');
      const playerItems = getFilteredNavigationItems('player');
      expect(adminItems.length).toBeGreaterThan(playerItems.length);
    });

    it('all player items should also be in admin items', () => {
      const adminItems = getFilteredNavigationItems('admin');
      const playerItems = getFilteredNavigationItems('player');
      const adminLabels = adminItems.map(i => i.label);
      playerItems.forEach(item => {
        expect(adminLabels).toContain(item.label);
      });
    });
  });
});
