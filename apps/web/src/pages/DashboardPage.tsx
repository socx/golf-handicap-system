import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Line,
  LineChart,
  ResponsiveContainer,
  TooltipProps,
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

interface TrendDateRange {
  from: string;
  to: string;
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

function parseIsoDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function TrendTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0]?.payload as
    | { date: string; handicapIndex: number; roundsUsed: number }
    | undefined;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{point.date}</p>
      <p className="mt-1 text-sm font-bold text-teal-700 dark:text-teal-400">
        Index: {point.handicapIndex.toFixed(1)}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Rounds used: {point.roundsUsed}</p>
    </div>
  );
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const playerId = user?.player_id ?? null;
  const [trendRange, setTrendRange] = useState<TrendDateRange>({ from: '', to: '' });
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
      calculationDate: point.calculationDate,
      date: formatDate(point.calculationDate),
      handicapIndex: point.handicapIndex,
      roundsUsed: point.roundsUsed.length,
    }));
  }, [state.summary]);

  const filteredTrendData = useMemo(() => {
    const fromDate = trendRange.from ? parseIsoDate(`${trendRange.from}T00:00:00`) : null;
    const toDate = trendRange.to ? parseIsoDate(`${trendRange.to}T23:59:59`) : null;

    return trendData.filter((point) => {
      const pointDate = parseIsoDate(point.calculationDate);
      if (!pointDate) return false;
      if (fromDate && pointDate < fromDate) return false;
      if (toDate && pointDate > toDate) return false;
      return true;
    });
  }, [trendData, trendRange.from, trendRange.to]);

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
                    <li key={round.id}>
                      <Link
                        to={`/rounds/${round.id}`}
                        className="block rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-700/80"
                      >
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
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className={widgetBaseClass} aria-label="Stats widget">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
                Stats
              </p>

              {state.loading && <div className="mt-4 h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />}

              {!state.loading && !state.error && state.summary && (
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <dt className="text-slate-500 dark:text-slate-400">GIR</dt>
                    <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {state.summary.stats.girPercentage.toFixed(1)}%
                    </dd>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <dt className="text-slate-500 dark:text-slate-400">FIR</dt>
                    <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {state.summary.stats.firPercentage.toFixed(1)}%
                    </dd>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <dt className="text-slate-500 dark:text-slate-400">Avg Putts</dt>
                    <dd className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {state.summary.stats.averagePutts.toFixed(2)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800/70">
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">
                Handicap Trend
              </p>

              <form className="flex flex-wrap items-end gap-2" aria-label="Trend date range filter">
                <div className="flex flex-col gap-1">
                  <label htmlFor="dashboard-trend-from" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    From
                  </label>
                  <input
                    id="dashboard-trend-from"
                    type="date"
                    value={trendRange.from}
                    onChange={(e) => setTrendRange((prev) => ({ ...prev, from: e.target.value }))}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="dashboard-trend-to" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    To
                  </label>
                  <input
                    id="dashboard-trend-to"
                    type="date"
                    value={trendRange.to}
                    onChange={(e) => setTrendRange((prev) => ({ ...prev, to: e.target.value }))}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </div>
                {(trendRange.from || trendRange.to) && (
                  <button
                    type="button"
                    onClick={() => setTrendRange({ from: '', to: '' })}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Reset
                  </button>
                )}
              </form>
            </div>

            {state.loading && <div className="mt-4 h-48 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />}

            {!state.loading && state.error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>
            )}

            {!state.loading && !state.error && filteredTrendData.length === 0 && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No handicap history available.</p>
            )}

            {!state.loading && !state.error && filteredTrendData.length > 0 && (
              <div className="mt-4 h-56" data-testid="dashboard-trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredTrendData}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={34} />
                    <Tooltip content={<TrendTooltip />} />
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
