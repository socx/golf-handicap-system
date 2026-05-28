import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { HandicapHistoryChart } from '../components/HandicapHistoryChart';

export const HandicapHistoryPage: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();

  if (!playerId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Handicap History
          </h2>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-400">Player ID is missing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Handicap History
        </h2>
        <Button variant="secondary" onClick={() => navigate(`/players/${playerId}`)}>
          Back to Profile
        </Button>
      </div>

      <HandicapHistoryChart playerId={playerId} />
    </div>
  );
};

export default HandicapHistoryPage;
