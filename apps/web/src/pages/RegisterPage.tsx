import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { AuthSplitLayout, AuthStatusCard } from '../components/auth/AuthSplitLayout';
import { authApi, handleApiError } from '../api/auth';
import { getAccessToken, getStoredUser } from '../lib/authStorage';

const registerSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    role: z.enum(['player', 'admin']).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type RegisterForm = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  const selfRegistrationEnabled = String(import.meta.env.VITE_SELF_REGISTRATION_ENABLED || 'false').toLowerCase() === 'true';
  const [submitting, setSubmitting] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('Please check your inbox for your activation link.');

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
      const role = isAdmin ? data.role || 'player' : 'player';
      const { data: response } = await authApi.register(data.email, data.password, role);
      setRegistrationMessage(response.message || 'Please check your inbox for your activation link.');
      setRegistrationComplete(true);
    } catch (error) {
      setError('root', { message: handleApiError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  const canRegister = isAdmin || selfRegistrationEnabled;

  if (registrationComplete) {
    return (
      <AuthSplitLayout
        intro="Registration submitted"
        introDetail=""
        title="Activation required"
        description="Your account has been created in an inactive state until the activation link is used."
        asideBadge="Email activation"
        asideEyebrow="Onboarding security"
        asideTitle="Every new account must be activated via email before sign-in."
        asideDescription="This ensures new users verify ownership of their email address before accessing player data."
        asideStats={[
          { value: 'Inactive', label: 'Until activation link is clicked' },
          { value: 'Player-only', label: 'Self-registration always uses player role' },
          { value: 'Verified', label: 'Activation confirms account ownership' },
        ]}
      >
        <AuthStatusCard
          eyebrow="Next step"
          title="Check your email"
          description={registrationMessage}
          action={(
            <Link
              to="/auth/login"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to sign in
            </Link>
          )}
        />
      </AuthSplitLayout>
    );
  }

  if (!accessChecked) {
    return (
      <AuthSplitLayout
        intro="Validating registration access"
        introDetail=""
        title="Checking permissions"
        description="Determining whether this environment allows self-registration or requires admin provisioning."
        asideBadge="Registration policy"
        asideEyebrow="Controlled onboarding"
        asideTitle="Registration behavior is controlled centrally via environment flags."
        asideDescription="Self-registration can be enabled for players only, while administrators can still provision users with explicit roles."
        asideStats={[
          { value: 'Flag-driven', label: 'Self-registration can be switched on or off' },
          { value: 'Inactive', label: 'New accounts require activation email click' },
          { value: 'Secure', label: 'Sign-in only available after activation' },
        ]}
      >
        <AuthStatusCard
          title="Checking permissions"
          description="Determining whether this environment currently allows self-registration."
          leading={<div className="h-10 w-10 animate-pulse rounded-full bg-teal-100" />}
        />
      </AuthSplitLayout>
    );
  }

  if (!canRegister) {
    return (
      <AuthSplitLayout
        intro="Self-registration is disabled"
        introDetail=""
        title="Registration unavailable"
        description="This environment requires an administrator to provision new accounts."
        asideBadge="Registration policy"
        asideEyebrow="Controlled onboarding"
        asideTitle="Self-registration is currently turned off in environment configuration."
        asideDescription="Ask an administrator to create your account. You will still receive an activation email and remain inactive until activated."
        asideStats={[
          { value: 'Admin managed', label: 'Admins provision registration details' },
          { value: 'Email activation', label: 'Account stays inactive until link click' },
          { value: 'Auditable', label: 'Provisioning path remains controlled' },
        ]}
      >
        <AuthStatusCard
          eyebrow="Disabled"
          title="Self-registration is disabled"
          description="Registration is currently restricted. Contact an administrator to provision your account."
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

  const intro = isAdmin ? 'Administrator-controlled account creation' : 'Player self-registration';
  const title = isAdmin ? 'Create a new user' : 'Create your player account';
  const description = isAdmin
    ? 'Use this form to provision player or admin access. New users remain inactive until they click their activation email link.'
    : 'Self-registration creates a player account only. Your account will remain inactive until you activate it from email.';

  return (
    <AuthSplitLayout
      intro={intro}
      introDetail=""
      title={title}
      description={description}
      asideBadge={isAdmin ? 'Admin workspace' : 'Self-registration'}
      asideEyebrow="Controlled onboarding"
      asideTitle="All registrations require email activation before first sign-in."
      asideDescription="New users are stored as inactive in the database and become active only after clicking their activation link."
      asideStats={[
        { value: 'Inactive first', label: 'Accounts start inactive by design' },
        { value: 'Email link', label: 'Activation requires link verification' },
        { value: isAdmin ? 'Admin + Player' : 'Player only', label: isAdmin ? 'Admin can assign role' : 'Self-signup cannot create admins' },
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

            {isAdmin ? (
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
            ) : null}

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
              {submitting ? 'Submitting registration...' : 'Register'}
            </button>
          </form>
    </AuthSplitLayout>
  );
};
