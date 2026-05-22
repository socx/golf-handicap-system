import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { AuthSplitLayout, AuthStatusCard } from '../components/auth/AuthSplitLayout';
import { authApi, handleApiError } from '../api/auth';
import { getAccessToken, getStoredUser } from '../lib/authStorage';

const registerSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    role: z.enum(['player', 'admin']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type RegisterForm = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'player' },
  });

  useEffect(() => {
    const checkAccess = async () => {
      const token = getAccessToken();
      const user = getStoredUser();
      if (!token || !user) {
        setAccessChecked(true);
        return;
      }

      try {
        const { data } = await authApi.me();
        setIsAdmin(data.user.role === 'admin');
      } catch {
        setIsAdmin(false);
      } finally {
        setAccessChecked(true);
      }
    };

    void checkAccess();
  }, []);

  const onSubmit = async (data: RegisterForm) => {
    setSubmitting(true);
    try {
      await authApi.register(data.email, data.password, data.role);
      navigate('/auth/login', { replace: true });
    } catch (error) {
      setError('root', { message: handleApiError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  if (!accessChecked) {
    return (
      <AuthSplitLayout
        intro="Validating admin access before opening registration"
        introDetail=""
        title="Checking permissions"
        description="Only authenticated admins can create users."
        asideBadge="Admin workspace"
        asideEyebrow="Controlled onboarding"
        asideTitle="Provision staff and players with the right permissions from a single administration flow."
        asideDescription="Registration is restricted to authenticated administrators so account creation stays auditable and role assignment stays deliberate."
        asideStats={[
          { value: 'Admins', label: 'Can create and manage privileged accounts' },
          { value: 'Players', label: 'Can access score and handicap workflows' },
          { value: 'Auditable', label: 'Role-based access remains explicit and reviewable' },
        ]}
      >
        <AuthStatusCard
          title="Checking permissions"
          description="Only authenticated admins can create users."
          leading={<div className="h-10 w-10 animate-pulse rounded-full bg-teal-100" />}
        />
      </AuthSplitLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AuthSplitLayout
        intro="Restricted administrative route"
        introDetail=""
        title="Admin-only registration"
        description="This route is reserved for authenticated administrators who are creating new users and assigning roles."
        asideBadge="Admin workspace"
        asideEyebrow="Controlled onboarding"
        asideTitle="Provision staff and players with the right permissions from a single administration flow."
        asideDescription="Registration is restricted to authenticated administrators so account creation stays auditable and role assignment stays deliberate."
        asideStats={[
          { value: 'Admins', label: 'Can create and manage privileged accounts' },
          { value: 'Players', label: 'Can access score and handicap workflows' },
          { value: 'Auditable', label: 'Role-based access remains explicit and reviewable' },
        ]}
      >
        <AuthStatusCard
          eyebrow="Access denied"
          title="Admin-only registration"
          description="This route is reserved for authenticated administrators who are creating new users and assigning roles."
          tone="warning"
          action={(
            <Link
              to="/auth/login"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Go to sign in
            </Link>
          )}
        />
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      intro="Administrator-controlled account creation"
      introDetail=""
      title="Create a new user"
      description="Use this form to provision player or admin access with explicit role assignment and password validation."
      asideBadge="Admin workspace"
      asideEyebrow="Controlled onboarding"
      asideTitle="Provision staff and players with the right permissions from a single administration flow."
      asideDescription="Registration is restricted to authenticated administrators so account creation stays auditable and role assignment stays deliberate."
      asideStats={[
        { value: 'Admins', label: 'Can create and manage privileged accounts' },
        { value: 'Players', label: 'Can access score and handicap workflows' },
        { value: 'Auditable', label: 'Role-based access remains explicit and reviewable' },
      ]}
      footer={(
        <>
          Finished provisioning?{' '}
          <Link className="font-semibold text-teal-700 transition hover:text-teal-800" to="/auth/login">
            Return to sign in
          </Link>
        </>
      )}
    >
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />
              {errors.email && <p className="mt-2 text-sm font-medium text-rose-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
                className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />
              {errors.password && <p className="mt-2 text-sm font-medium text-rose-600">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register('confirmPassword')}
                className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              />
              {errors.confirmPassword && (
                <p className="mt-2 text-sm font-medium text-rose-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-slate-700">
                Role
              </label>
              <select
                id="role"
                {...register('role')}
                className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
              >
                <option value="player">player</option>
                <option value="admin">admin</option>
              </select>
            </div>

            {errors.root?.message && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {errors.root.message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3.5 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating user...' : 'Create user'}
            </button>
          </form>
    </AuthSplitLayout>
  );
};
