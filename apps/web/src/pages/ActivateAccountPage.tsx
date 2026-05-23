import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi, handleApiError } from '../api/auth';
import { AuthSplitLayout, AuthStatusCard } from '../components/auth/AuthSplitLayout';

type ActivationState = 'loading' | 'success' | 'error';

export const ActivateAccountPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = (searchParams.get('token') || '').trim();
  const [state, setState] = useState<ActivationState>(token ? 'loading' : 'error');
  const [message, setMessage] = useState(
    token ? 'Activating your account...' : 'Activation token is missing from this link.',
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    const activate = async () => {
      try {
        const { data } = await authApi.activateAccount(token);
        setState('success');
        setMessage(data.message || 'Account activated successfully. You can now sign in.');
      } catch (error) {
        setState('error');
        setMessage(handleApiError(error));
      }
    };

    void activate();
  }, [token]);

  const cardByState: Record<ActivationState, React.ReactNode> = {
    loading: (
      <AuthStatusCard
        title="Activating account"
        description={message}
        leading={<div className="h-10 w-10 animate-pulse rounded-full bg-teal-100" />}
      />
    ),
    success: (
      <AuthStatusCard
        eyebrow="Success"
        title="Account activated"
        description={message}
        action={(
          <Link
            to="/auth/login"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Sign in now
          </Link>
        )}
      />
    ),
    error: (
      <AuthStatusCard
        eyebrow="Activation failed"
        title="Unable to activate account"
        description={message}
        tone="warning"
        action={(
          <Link
            to="/auth/register"
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Back to registration
          </Link>
        )}
      />
    ),
  };

  return (
    <AuthSplitLayout
      intro="Account onboarding"
      introDetail=""
      title="Activate your account"
      description="Finish account setup by confirming your activation link."
      asideBadge="Account setup"
      asideEyebrow="Secure onboarding"
      asideTitle="Your account remains inactive until email verification is complete."
      asideDescription="This protects user onboarding and ensures only verified owners can sign in and access player records."
      asideStats={[
        { value: 'Inactive', label: 'Until activation link is used' },
        { value: 'Email verified', label: 'Activation confirms account ownership' },
        { value: 'Secure', label: 'Only verified users can sign in' },
      ]}
    >
      {cardByState[state]}
    </AuthSplitLayout>
  );
};

export default ActivateAccountPage;
