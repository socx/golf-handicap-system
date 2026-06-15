// @vitest-environment jsdom

import './setup';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '../api/auth';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import { LoginPage } from '../pages/LoginPage';

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../components/auth/AuthSplitLayout', () => ({
  AuthSplitLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AuthStatusCard: ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  ),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Forgot/Reset password pages', () => {
  it('shows forgot password link on login page', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/auth/forgot-password');
  });

  it('submits forgot password request and shows confirmation state', async () => {
    const requestSpy = vi.spyOn(authApi, 'requestPasswordReset').mockResolvedValue({
      data: { message: 'If that email is registered you will receive a reset link shortly.' },
    } as never);

    render(      <MemoryRouter initialEntries={['/auth/forgot-password']}>
        <Routes>
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() => expect(requestSpy).toHaveBeenCalledWith('user@example.test'));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('submits reset password confirmation with token from query', async () => {
    const confirmSpy = vi.spyOn(authApi, 'confirmPasswordReset').mockResolvedValue({
      data: { message: 'Password reset successfully' },
    } as never);

    render(
      <MemoryRouter initialEntries={['/reset-password?token=abc123']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledWith('abc123', 'new-password-123'));
    expect(await screen.findByText('Password updated')).toBeInTheDocument();
  });
});
