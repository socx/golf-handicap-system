import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '../api/auth';
import { handleApiError } from '../api/client';
import { AuthSplitLayout, AuthStatusCard } from '../components/auth/AuthSplitLayout';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

const ForgotPasswordPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('If that email is registered you will receive a reset link shortly.');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setSubmitting(true);
    try {
      const response = await authApi.requestPasswordReset(data.email.trim().toLowerCase());
      setMessage(response.data.message || 'If that email is registered you will receive a reset link shortly.');
      setSubmitted(true);
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
      title="Forgot password"
      description="Request a secure password reset link by entering your account email address."
      asideBadge="Recovery"
      asideEyebrow="Secure reset"
      asideTitle="Password reset links are time-limited and one-time use."
      asideDescription="For security, the request response is the same whether or not the email exists in the system."
      asideStats={[
        { value: 'One-time', label: 'Token cannot be reused' },
        { value: 'Time-limited', label: 'Reset link expires automatically' },
        { value: 'Non-enumerating', label: 'Same response for all emails' },
      ]}
      footer={(
        <>
          Remembered your password?{' '}
          <Link className="font-semibold text-teal-700 transition hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200" to="/auth/login">
            Back to sign in
          </Link>
        </>
      )}
    >
      {submitted ? (
        <AuthStatusCard
          eyebrow="Request received"
          title="Check your email"
          description={message}
          action={(
            <Link
              to="/auth/login"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Return to sign in
            </Link>
          )}
        />
      ) : (
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
            {errors.email ? <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">{errors.email.message}</p> : null}
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
            {submitting ? 'Sending reset link...' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthSplitLayout>
  );
};

export default ForgotPasswordPage;
