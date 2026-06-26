// @vitest-environment jsdom

import './setup';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as authApi from '../api/auth';
import SettingsPage from '../pages/SettingsPage';

const { mockRefreshUser, mockShowErrorToast, mockShowSuccessToast } = vi.hoisted(() => ({
  mockRefreshUser: vi.fn(async () => {}),
  mockShowErrorToast: vi.fn(),
  mockShowSuccessToast: vi.fn(),
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'player@example.com', role: 'player' },
    refreshUser: mockRefreshUser,
  }),
}));

vi.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../lib/toast', () => ({
  showErrorToast: mockShowErrorToast,
  showSuccessToast: mockShowSuccessToast,
}));

const defaultPrefs = {
  handicap_updates_enabled: true,
  round_submitted_enabled: false,
  round_approved_enabled: true,
  marketing_enabled: false,
  theme_mode: 'system' as const,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockRefreshUser.mockClear();
  mockShowErrorToast.mockClear();
  mockShowSuccessToast.mockClear();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SettingsPage', () => {
  it('loads and displays notification preferences', async () => {
    vi.spyOn(authApi.authApi, 'getNotificationPreferences').mockResolvedValue({
      data: { preferences: defaultPrefs },
    } as never);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Handicap calculated' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Round submitted' })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Round approved' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Marketing updates' })).not.toBeChecked();
    });
  });

  it('saves profile and calls refreshUser', async () => {
    vi.spyOn(authApi.authApi, 'getNotificationPreferences').mockResolvedValue({
      data: { preferences: defaultPrefs },
    } as never);
    const updateProfileSpy = vi.spyOn(authApi.authApi, 'updateProfile').mockResolvedValue({
      data: { email: 'new@example.com' },
    } as never);

    renderPage();

    const emailInput = await waitFor(() => screen.getByRole('textbox', { name: 'Email address' }));
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(updateProfileSpy).toHaveBeenCalledWith('new@example.com'));
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it('saves notification preferences', async () => {
    vi.spyOn(authApi.authApi, 'getNotificationPreferences').mockResolvedValue({
      data: { preferences: defaultPrefs },
    } as never);
    const updatePrefsSpy = vi.spyOn(authApi.authApi, 'updateNotificationPreferences').mockResolvedValue({
      data: { preferences: { ...defaultPrefs, round_submitted_enabled: true } },
    } as never);

    renderPage();

    const roundSubmittedCheckbox = await waitFor(() =>
      screen.getByRole('checkbox', { name: 'Round submitted' }),
    );
    fireEvent.click(roundSubmittedCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));

    await waitFor(() =>
      expect(updatePrefsSpy).toHaveBeenCalledWith(
        expect.objectContaining({ round_submitted_enabled: true }),
      ),
    );
  });

  it('shows error when password fields do not match', async () => {
    vi.spyOn(authApi.authApi, 'getNotificationPreferences').mockResolvedValue({
      data: { preferences: defaultPrefs },
    } as never);

    renderPage();

    await waitFor(() => screen.getByRole('textbox', { name: 'Email address' }));

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'correct-pass' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'newpass123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() =>
      expect(mockShowErrorToast).toHaveBeenCalledWith(
        'Passwords do not match',
        'New password and confirmation must be identical.',
      ),
    );
  });

  it('submits password change when fields are valid', async () => {
    vi.spyOn(authApi.authApi, 'getNotificationPreferences').mockResolvedValue({
      data: { preferences: defaultPrefs },
    } as never);
    const changePasswordSpy = vi.spyOn(authApi.authApi, 'changePassword').mockResolvedValue({
      data: { message: 'Password updated' },
    } as never);

    renderPage();

    await waitFor(() => screen.getByRole('textbox', { name: 'Email address' }));

    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'current-pass' },
    });
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'newpass123' },
    });
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'newpass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));

    await waitFor(() => expect(changePasswordSpy).toHaveBeenCalledWith('current-pass', 'newpass123'));
  });
});
