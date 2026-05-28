import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { getHandicapHistory, type HandicapRecord } from '../api/handicap';
import { handleApiError } from '../api/client';

interface HandicapHistoryChartProps {
  playerId: string;
}

interface ChartDataPoint {
  date: string;
  dateLabel: string;
  handicapIndex: number;
  roundsUsed: string[];
  numRounds: number;
}

interface DateRange {
  from: string;
  to: string;
}

function buildHistoryOptions(range?: DateRange): { from?: string; to?: string } {
  const options: { from?: string; to?: string } = {};
  if (range?.from) options.from = new Date(range.from).toISOString();
  if (range?.to) options.to = new Date(range.to + 'T23:59:59').toISOString();
  return options;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toChartData(records: HandicapRecord[]): ChartDataPoint[] {
  // Records come newest-first, reverse for chronological chart
  return [...records].reverse().map((r) => ({
    date: r.calculationDate,
    dateLabel: formatDate(r.calculationDate),
    handicapIndex: r.handicapIndex,
    roundsUsed: Array.isArray(r.roundsUsed) ? r.roundsUsed : [],
    numRounds: Array.isArray(r.roundsUsed) ? r.roundsUsed.length : 0,
  }));
}

interface CustomTooltipPayload {
  payload: {
    dateLabel: string;
    handicapIndex: number;
    numRounds: number;
  };
}

function CustomTooltip({
  active,
  payload,
}: TooltipProps<number, string> & { payload?: CustomTooltipPayload[] }) {
  if (!active || !payload?.length) return null;

  const data = (payload[0] as unknown as { payload: ChartDataPoint }).payload;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{data.dateLabel}</p>
      <p className="mt-1 text-sm font-bold text-teal-700 dark:text-teal-400">
        Index: {data.handicapIndex.toFixed(1)}
      </p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Rounds used: {data.numRounds}
      </p>
    </div>
  );
}

export const HandicapHistoryChart: React.FC<HandicapHistoryChartProps> = ({ playerId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' });

  const fetchHistory = async (range?: DateRange) => {
    setLoading(true);
    setError(null);
    try {
      const options = buildHistoryOptions(range);
      const response = await getHandicapHistory(playerId, options);
      setChartData(toChartData(response.records));
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitialHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await getHandicapHistory(playerId, buildHistoryOptions());
        if (cancelled) return;
        setChartData(toChartData(response.records));
      } catch (err) {
        if (cancelled) return;
        setError(handleApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadInitialHistory();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const handleFilterApply = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory(dateRange);
  };

  const handleFilterReset = () => {
    const emptyRange = { from: '', to: '' };
    setDateRange(emptyRange);
    fetchHistory(emptyRange);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Handicap History
        </p>

        {/* Date range filter */}
        <form
          onSubmit={handleFilterApply}
          className="flex flex-wrap items-end gap-2"
          aria-label="Date range filter"
        >
          <div className="flex flex-col gap-1">
            <label
              htmlFor="from-date"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              From
            </label>
            <input
              id="from-date"
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="to-date"
              className="text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              To
            </label>
            <input
              id="to-date"
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700"
          >
            Apply
          </button>
          {(dateRange.from || dateRange.to) && (
            <button
              type="button"
              onClick={handleFilterReset}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {loading && (
        <div className="mt-6 h-64 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      )}

      {!loading && error && (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && chartData.length === 0 && (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          No handicap history data available.
        </p>
      )}

      {!loading && !error && chartData.length > 0 && (
        <div className="mt-6 w-full" data-testid="chart-container">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="dateLabel"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="handicapIndex"
                stroke="#0f766e"
                strokeWidth={2}
                dot={{ r: 4, fill: '#0f766e', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#0f766e' }}
                name="Handicap Index"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
