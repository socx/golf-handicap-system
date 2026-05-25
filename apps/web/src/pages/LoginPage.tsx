import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthSplitLayout } from '../components/auth/AuthSplitLayout';
import { handleApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const selfRegistrationEnabled = String(import.meta.env.VITE_SELF_REGISTRATION_ENABLED || 'false').toLowerCase() === 'true';
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/';
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setSubmitting(true);
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (error) {
      setError('root', { message: handleApiError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout
      intro="Competition administration and player handicap management"
      introDetail=""
      title="Sign in to continue"
      description="Access player records, round processing, and administrative tools from one place."
      asideBadge="Live handicap updates"
      asideEyebrow="Operations cockpit"
      asideTitle="Run competitions, manage members, and publish results without leaving the same workspace."
      asideDescription="Built for club admins who need reliable access to handicap history, player account management, and round validation."
      asideStats={[
        { value: '24/7', label: 'Round-entry and auth availability' },
        { value: 'Role-based', label: 'Admin registration and protected access' },
        { value: 'Single source', label: 'Player and competition data in one system' },
      ]}
      footer={selfRegistrationEnabled ? (
        <>
          Need an account?{' '}
          <Link className="font-semibold text-teal-700 transition hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200" to="/auth/register">
            Register as a player
          </Link>
        </>
      ) : 'Need an account? Contact an administrator for an activation invite.'}
    >
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition-colors focus:border-teal-500 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-teal-900/40"
              />
              {errors.email && <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <span className="text-sm font-medium text-teal-700 dark:text-teal-300">Secure access</span>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
                className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition-colors focus:border-teal-500 focus:ring-4 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-teal-900/40"
              />
              {errors.password && <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{errors.password.message}</p>}
            </div>

            {errors.root?.message && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                {errors.root.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
    </AuthSplitLayout>
  );
};
