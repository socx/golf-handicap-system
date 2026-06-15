// @vitest-environment jsdom

import './setup';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminUsersPage from '../pages/AdminUsersPage';
import { adminUsersApi } from '../api/adminUsers';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'admin-1', email: 'admin@example.test', role: 'admin', is_active: true },
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/admin/users" element={<AdminUsersPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminUsersPage', () => {
  it('renders users and allows activating an inactive user', async () => {
    vi.spyOn(adminUsersApi, 'list').mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-1',
            email: 'inactive@example.test',
            role: 'player',
            is_active: false,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            deleted_at: null,
          },
        ],
        total: 1,
        includeDeleted: false,
        filters: { search: '', role: '', status: null },
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        message: 'ok',
      },
    } as never);

    const activateSpy = vi.spyOn(adminUsersApi, 'activate').mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'inactive@example.test',
          role: 'player',
          is_active: true,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted_at: null,
        },
        notificationEmailSent: true,
        message: 'User activated successfully',
      },
    } as never);

    renderPage();

    await waitFor(() => expect(screen.getByText('inactive@example.test')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Activate' }));

    await waitFor(() => expect(activateSpy).toHaveBeenCalledWith('user-1'));
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('allows deactivating an active user', async () => {
    vi.spyOn(adminUsersApi, 'list').mockResolvedValue({
      data: {
        users: [
          {
            id: 'user-2',
            email: 'active@example.test',
            role: 'player',
            is_active: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
            deleted_at: null,
          },
        ],
        total: 1,
        includeDeleted: false,
        filters: { search: '', role: '', status: null },
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        message: 'ok',
      },
    } as never);

    const deactivateSpy = vi.spyOn(adminUsersApi, 'deactivate').mockResolvedValue({
      data: {
        user: {
          id: 'user-2',
          email: 'active@example.test',
          role: 'player',
          is_active: false,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          deleted_at: null,
        },
        notificationEmailSent: false,
        message: 'User deactivated successfully',
      },
    } as never);

    renderPage();

    await waitFor(() => expect(screen.getByText('active@example.test')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(deactivateSpy).toHaveBeenCalledWith('user-2'));
    expect(screen.getByText('inactive')).toBeInTheDocument();
  });
});
