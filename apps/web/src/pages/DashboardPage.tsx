import React from 'react';

const widgetBaseClass = 'rounded-2xl border border-slate-200 bg-slate-50 p-5';

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          This shell is ready for incremental widget delivery across handicap, rounds, and player insights.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <article className={widgetBaseClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Handicap Summary</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Placeholder Widget</h3>
          <p className="mt-2 text-sm text-slate-600">Upcoming work: current handicap, trend, and latest index calculation.</p>
        </article>

        <article className={widgetBaseClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Recent Rounds</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Placeholder Widget</h3>
          <p className="mt-2 text-sm text-slate-600">Upcoming work: latest submitted rounds with validation and status highlights.</p>
        </article>

        <article className={widgetBaseClass}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Stats</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">Placeholder Widget</h3>
          <p className="mt-2 text-sm text-slate-600">Upcoming work: scoring analytics, participation trends, and leaderboard snapshots.</p>
        </article>
      </section>
    </div>
  );
};

export default DashboardPage;
