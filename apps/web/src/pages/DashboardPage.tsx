import React, { useEffect, useMemo, useState } from 'react';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getDashboardSummary, type DashboardSummaryResponse } from '../api/dashboard';
import { handleApiError } from '../api/client';
import { HandicapSummaryWidget } from '../components/HandicapSummaryWidget';
import { Icon } from '../components/ui/Icon';
import { LayoutDashboard } from '../components/ui/icons';
import { useAuth } from '../hooks/useAuth';

interface DashboardState {
  loading: boolean;
  error: string | null;
  summary: DashboardSummaryResponse | null;
}

const widgetBaseClass =
  'rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/60';

function formatDate(isoValue: string): string {
  return new Date(isoValue).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatRoundStatus(status: 'pending' | 'approved' | 'rejected'): string {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const playerId = user?.player_id ?? null;
  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: null,
    summary: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!playerId) {
        setState({ loading: false, error: null, summary: null });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: null }));

      try {
        const summary = await getDashboardSummary(playerId);
        if (cancelled) return;
        setState({ loading: false, error: null, summary });
      } catch (error) {
        if (cancelled) return;
        setState({ loading: false, error: handleApiError(error), summary: null });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const trendData = useMemo(() => {
    const points = state.summary?.handicapTrend || [];
    return [...points].reverse().map((point) => ({
      date: formatDate(point.calculationDate),
      handicapIndex: point.handicapIndex,
      roundsUsed: point.roundsUsed.length,
    }));
  }, [state.summary]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={LayoutDashboard} size="lg" className="text-teal-600 dark:text-teal-400" />
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Your latest rounds, handicap trend, and scoring insights in one view.
        </p>
      </div>

      {!playerId && (
        <article className={widgetBaseClass}>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Dashboard analytics are available when your account is linked to a player profile.
          </p>
        </article>
      )}

      {playerId && (
        <>
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <HandicapSummaryWidget playerId={playerId} />

            <article className={widgetBaseClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
                Recent Rounds
              </p>

              {state.loading && <div className="mt-4 h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />}

              {!state.loading && state.error && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>
              )}

              {!state.loading && !state.error && state.summary && state.summary.recentRounds.length === 0 && (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No rounds submitted yet.</p>
              )}

              {!state.loading && !state.error && state.summary && state.summary.recentRounds.length > 0 && (
                <ul className="mt-3 space-y-2" aria-label="Recent rounds list">
                  {state.summary.recentRounds.map((round) => (
                    <li key={round.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {round.courseName || 'Unknown course'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatRoundStatus(round.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(round.playedAt)} • Gross {round.grossScore} • Adjusted {round.adjustedGrossScore}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className={widgetBaseClass}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
                Stats
              </p>

              {state.loading && <div className="mt-4 h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />}

              {!state.loading && !state.error && state.summary && (
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">GIR</dt>
                    <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {state.summary.stats.girPercentage.toFixed(1)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">FIR</dt>
                    <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {state.summary.stats.firPercentage.toFixed(1)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Avg Putts</dt>
                    <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {state.summary.stats.averagePutts.toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Avg Penalties</dt>
                    <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {state.summary.stats.averagePenalties.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              )}

              {!state.loading && state.error && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>
              )}
            </article>
          </section>

          <section className={widgetBaseClass}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
              Handicap Trend
            </p>

            {state.loading && <div className="mt-4 h-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />}

            {!state.loading && state.error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>
            )}

            {!state.loading && !state.error && trendData.length === 0 && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No handicap history available.</p>
            )}

            {!state.loading && !state.error && trendData.length > 0 && (
              <div className="mt-4 h-56" data-testid="dashboard-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={34} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="handicapIndex"
                      stroke="#0f766e"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#0f766e' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default DashboardPage;
