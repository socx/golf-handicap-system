import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { authApi, handleApiError, setStoredUser, setTokens } from '../lib/api';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginForm = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setSubmitting(true);
    try {
      const { data: response } = await authApi.login(data.email, data.password);
      setTokens(response.tokens.accessToken, response.tokens.refreshToken);
      setStoredUser(response.user);
      navigate('/', { replace: true });
    } catch (error) {
      setError('root', { message: handleApiError(error) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
        <div className="mb-6 flex justify-center">
          <Logo size="md" showText={true} />
        </div>

        <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">Use your account credentials to continue.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              {...register('email')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none ring-teal-500 focus:ring"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              {...register('password')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none ring-teal-500 focus:ring"
            />
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
          </div>

          {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-teal-600 px-3 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-sm text-gray-600">
          Need to create a user?{' '}
          <Link className="font-medium text-teal-700 hover:underline" to="/auth/register">
            Admin registration page
          </Link>
        </p>
      </div>
    </div>
  );
};
