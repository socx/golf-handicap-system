import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { TrendingUp, ArrowLeft } from '../components/ui/icons';
import { useAuth } from '../hooks/useAuth';

const HandicapPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user?.role === 'player' && user.player_id) {
    return <Navigate to={`/handicap/history/${user.player_id}`} replace />;
  }

  if (user?.role === 'player') {
    return (
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={TrendingUp} size="lg" className="text-teal-600 dark:text-teal-400" />
          Handicap
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your account is not linked to a player profile yet. Ask an administrator to link your user to a player record.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={TrendingUp} size="lg" className="text-teal-600 dark:text-teal-400" />
          Handicap
        </h2>
        <Button variant="secondary" onClick={() => navigate('/players')}>
          <Icon icon={ArrowLeft} size="sm" />
          Go to Players
        </Button>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Select a player profile to view handicap history, eligibility, and trend details.
      </p>
    </div>
  );
};

export default HandicapPage;
