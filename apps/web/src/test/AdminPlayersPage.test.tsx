// @vitest-environment jsdom

import './setup';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playersApi } from '../api/players';
import AdminPlayersPage from '../pages/AdminPlayersPage';

vi.mock('../lib/toast', () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AdminPlayersPage', () => {
  it('runs a dry-run CSV import and renders validation results', async () => {
    vi.spyOn(playersApi, 'list').mockResolvedValue({
      players: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
    });

    const importSpy = vi.spyOn(playersApi, 'importCsv').mockResolvedValue({
      dryRun: true,
      summary: {
        rowCount: 2,
        validRows: 1,
        invalidRows: 1,
        totalIssues: 2,
      },
      rows: [
        {
          rowNumber: 2,
          values: {
            first_name: 'Jane',
            last_name: 'Example',
            dob: '1991-06-15',
            gender: 'female',
            club: 'Import Club',
            country: 'GB',
            email: 'jane@example.com',
          },
          issues: [],
        },
        {
          rowNumber: 3,
          values: {
            first_name: 'Solo',
            last_name: '',
            dob: null,
            gender: null,
            club: 'Import Club',
            country: 'GB',
            email: 'bad-email',
          },
          issues: [
            { field: 'last_name', message: 'Last name is required' },
            { field: 'email', message: 'Email must be a valid address' },
          ],
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/admin/players']}>
        <Routes>
          <Route path="/admin/players" element={<AdminPlayersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const textarea = await screen.findByLabelText('Player CSV');
    fireEvent.change(textarea, {
      target: {
        value: 'name,dob,gender,club,email,country\nJane Example,1991-06-15,female,Import Club,jane@example.com,GB',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dry run validation' }));

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledWith(
        'name,dob,gender,club,email,country\nJane Example,1991-06-15,female,Import Club,jane@example.com,GB',
        true,
      );
    });

    expect(await screen.findByText('Dry run summary: 2 rows processed')).toBeInTheDocument();
    expect(screen.getByText('No validation issues.')).toBeInTheDocument();
    expect(screen.getByText('last_name: Last name is required')).toBeInTheDocument();
    expect(screen.getByText('email: Email must be a valid address')).toBeInTheDocument();
  });
});
