// @vitest-environment jsdom

import './setup';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { releaseNotesApi } from '../api/releaseNotes';
import ReleaseNotesPage from '../pages/ReleaseNotesPage';
import AdminReleaseNotesPage from '../pages/AdminReleaseNotesPage';

vi.mock('../lib/toast', () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ReleaseNotesPage', () => {
  it('renders markdown-backed content from the API', async () => {
    vi.spyOn(releaseNotesApi, 'get').mockResolvedValue({
      data: {
        markdown: '# What\'s New\n\n## June Update\n- Added maintenance banner',
        updatedAt: '2026-06-27T08:00:00.000Z',
      },
    } as never);

    render(
      <MemoryRouter initialEntries={['/whats-new']}>
        <Routes>
          <Route path="/whats-new" element={<ReleaseNotesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('June Update')).toBeInTheDocument();
    expect(screen.getByText('Added maintenance banner')).toBeInTheDocument();
  });
});

describe('AdminReleaseNotesPage', () => {
  it('loads markdown and saves edited release notes', async () => {
    vi.spyOn(releaseNotesApi, 'get').mockResolvedValue({
      data: {
        markdown: '# What\'s New\n\n## Existing\n- One item',
        updatedAt: '2026-06-27T08:00:00.000Z',
      },
    } as never);

    const updateSpy = vi.spyOn(releaseNotesApi, 'update').mockResolvedValue({
      data: {
        markdown: '# What\'s New\n\n## Existing\n- Updated item',
        updatedAt: '2026-06-27T09:00:00.000Z',
        message: 'Release notes updated successfully',
      },
    } as never);

    render(
      <MemoryRouter initialEntries={['/admin/release-notes']}>
        <Routes>
          <Route path="/admin/release-notes" element={<AdminReleaseNotesPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const editor = await screen.findByLabelText('Release notes markdown');
    fireEvent.change(editor, { target: { value: '# What\'s New\n\n## Existing\n- Updated item' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save release notes' }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('# What\'s New\n\n## Existing\n- Updated item');
    });
  });
});
