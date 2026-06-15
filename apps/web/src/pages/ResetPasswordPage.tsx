import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '../api/auth';
import { handleApiError } from '../api/client';
import { AuthSplitLayout, AuthStatusCard } from '../components/auth/AuthSplitLayout';

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState('Password reset successfully. You can now sign in with your new password.');

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(resetPasswordSchema) });

  const missingToken = useMemo(() => token.length === 0, [token]);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      setError('root', { message: 'Reset token is missing. Please use the link from your email.' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await authApi.confirmPasswordReset(token, data.password);
      setMessage(response.data.message || 'Password reset successfully. You can now sign in with your new password.');
      setCompleted(true);
      window.setTimeout(() => {
        navigate('/auth/login', { replace: true, state: { passwordResetSuccess: true } });
      }, 1500);
    } catch (error) {
      setError('root', { message: handleApiError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      intro="Account recovery"
      introDetail=""
      title="Reset password"
      description="Set a new password for your account using the secure reset token from your email."
      asideBadge="Recovery"
      asideEyebrow="Secure reset"
      asideTitle="Reset tokens are validated before password updates are applied."
      asideDescription="Invalid, expired, or already-used tokens are rejected to protect account security."
      asideStats={[
        { value: 'Validated', label: 'Token checked before reset' },
        { value: '8+ chars', label: 'Minimum password length' },
        { value: 'Safe', label: 'Single-use token workflow' },
      ]}
      footer={(
        <>
          Need a new reset link?{' '}
          <Link className="font-semibold text-teal-700 transition hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200" to="/auth/forgot-password">
            Request another one
          </Link>
        </>
      )}
    >
      {missingToken ? (
        <AuthStatusCard
          eyebrow="Invalid link"
          title="Reset token missing"
          description="This password reset link is missing a token. Request a new reset email to continue."
          tone="warning"
          action={(
            <Link
              to="/auth/forgot-password"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Request reset link
            </Link>
          )}
        />
      ) : completed ? (
        <AuthStatusCard
          eyebrow="Success"
          title="Password updated"
          description={message}
          action={(
            <Link
              to="/auth/login"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Go to sign in
            </Link>
          )}
        />
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              New password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition-colors focus:border-teal-500 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-teal-900/40"
            />
            {errors.password ? <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{errors.password.message}</p> : null}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition-colors focus:border-teal-500 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-teal-900/40"
            />
            {errors.confirmPassword ? <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{errors.confirmPassword.message}</p> : null}
          </div>

          {errors.root?.message ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
              {errors.root.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
          >
            {submitting ? 'Resetting password...' : 'Reset password'}
          </button>
        </form>
      )}
    </AuthSplitLayout>
  );
};

export default ResetPasswordPage;
