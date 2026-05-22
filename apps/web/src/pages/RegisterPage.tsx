import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, getAccessToken, getStoredUser, handleApiError } from '../lib/api';

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
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Admin-only registration</h1>
          <p className="mt-2 text-sm text-gray-600">
            This page is restricted to authenticated admin users.
          </p>
          <Link to="/auth/login" className="mt-4 inline-block text-sm font-medium text-teal-700 hover:underline">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Create user</h1>
        <p className="mt-1 text-sm text-gray-500">Admin-only registration form.</p>

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

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              {...register('confirmPassword')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none ring-teal-500 focus:ring"
            />
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>}
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              id="role"
              {...register('role')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none ring-teal-500 focus:ring"
            >
              <option value="player">player</option>
              <option value="admin">admin</option>
            </select>
          </div>

          {errors.root?.message && <p className="text-sm text-red-600">{errors.root.message}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-teal-600 px-3 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-60"
          >
            {submitting ? 'Creating user...' : 'Create user'}
          </button>
        </form>
      </div>
    </div>
  );
};
