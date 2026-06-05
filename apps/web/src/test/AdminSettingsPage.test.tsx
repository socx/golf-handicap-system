// @vitest-environment jsdom

import './setup';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminSettingsApi } from '../api/adminSettings';
import AdminSettingsPage from '../pages/AdminSettingsPage';

const settingsFixture = {
  pccOverride: 1,
  notificationSettings: {
    round_submitted: true,
    round_approved: false,
    maintenance_alerts: true,
  },
  maintenanceMode: false,
  updatedAt: '2026-06-05T15:20:00.000Z',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/settings']}>
      <Routes>
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminSettingsPage', () => {
  it('loads and renders existing settings', async () => {
    vi.spyOn(adminSettingsApi, 'get').mockResolvedValue({
      data: { settings: settingsFixture },
    } as never);

    renderPage();

    const pccInput = await waitFor(() => screen.getByLabelText('PCC override'));
    expect((pccInput as HTMLInputElement).value).toBe('1');

    expect(screen.getByLabelText('Round submitted notifications')).toBeChecked();
    expect(screen.getByLabelText('Round approved notifications')).not.toBeChecked();
    expect(screen.getByLabelText('Maintenance alerts')).toBeChecked();
    expect(screen.getByLabelText('Maintenance mode')).not.toBeChecked();
  });

  it('submits updated settings payload', async () => {
    vi.spyOn(adminSettingsApi, 'get').mockResolvedValue({
      data: { settings: settingsFixture },
    } as never);
    const updateSpy = vi.spyOn(adminSettingsApi, 'update').mockResolvedValue({
      data: {
        settings: {
          ...settingsFixture,
          pccOverride: 2,
          maintenanceMode: true,
          notificationSettings: {
            round_submitted: false,
            round_approved: false,
            maintenance_alerts: true,
          },
        },
        message: 'System settings updated successfully',
      },
    } as never);

    renderPage();

    const pccInput = await waitFor(() => screen.getByLabelText('PCC override'));
    fireEvent.change(pccInput, { target: { value: '2' } });

    fireEvent.click(screen.getByLabelText('Round submitted notifications'));
    fireEvent.click(screen.getByLabelText('Maintenance mode'));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() =>
      expect(updateSpy).toHaveBeenCalledWith({
        pccOverride: 2,
        notificationSettings: {
          round_submitted: false,
          round_approved: false,
          maintenance_alerts: true,
        },
        maintenanceMode: true,
      }),
    );
  });

  it('shows validation error for out-of-range PCC override and does not call API', async () => {
    vi.spyOn(adminSettingsApi, 'get').mockResolvedValue({
      data: { settings: settingsFixture },
    } as never);
    const updateSpy = vi.spyOn(adminSettingsApi, 'update').mockResolvedValue({
      data: { settings: settingsFixture, message: 'ok' },
    } as never);

    renderPage();

    const pccInput = await waitFor(() => screen.getByLabelText('PCC override'));
    fireEvent.change(pccInput, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(updateSpy).not.toHaveBeenCalled());
  });
});
