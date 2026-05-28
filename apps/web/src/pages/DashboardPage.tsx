import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { HandicapSummaryWidget } from '../components/HandicapSummaryWidget';

const widgetBaseClass = 'rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/60';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const playerId = user?.player_id ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          This shell is ready for incremental widget delivery across handicap, rounds, and player insights.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {playerId && <HandicapSummaryWidget playerId={playerId} />}

        <article className={widgetBaseClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Recent Rounds</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Placeholder Widget</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Upcoming work: latest submitted rounds with validation and status highlights.</p>
        </article>

        <article className={widgetBaseClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Stats</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">Placeholder Widget</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Upcoming work: scoring analytics, participation trends, and leaderboard snapshots.</p>
        </article>
      </section>
    </div>
  );
};

export default DashboardPage;
