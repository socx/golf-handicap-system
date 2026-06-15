import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../api/admin';
import { handleApiError } from '../api/client';
import { Icon } from '../components/ui/Icon';
import { Logs, RefreshCw } from '../components/ui/icons';
import { Table, TableHead, TableRow, TableHeaderCell, TableBody, TableCell } from '../components/ui/Table';
import { SkeletonTable } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';

interface AuditLog {
  id: string;
  event_type: string;
  user_id: string | null;
  actor_user_id: string | null;
  ip_address: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface FilterPreset {
  label: string;
  eventTypes: string[];
}

const ROUND_EVENT_PRESETS: Record<string, FilterPreset> = {
  all_round: {
    label: 'All Round Events',
    eventTypes: ['round_created', 'round_updated', 'round_approved'],
  },
  submissions: {
    label: 'Round Submissions',
    eventTypes: ['round_created'],
  },
  edits: {
    label: 'Round Edits',
    eventTypes: ['round_updated'],
  },
  approvals: {
    label: 'Round Approvals',
    eventTypes: ['round_approved'],
  },
};

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value || '');
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

const AdminAuditLogsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const page = parsePositiveInt(searchParams.get('page'), 1);
  const limit = 50;
  const [total, setTotal] = useState(0);
  const eventTypeFilter = (searchParams.get('eventType') || '').trim();
  const userIdFilter = (searchParams.get('userId') || '').trim();
  const fromDate = (searchParams.get('from') || '').trim();
  const toDate = (searchParams.get('to') || '').trim();
  const selectedPreset = useMemo(() => {
    const preset = (searchParams.get('preset') || '').trim();
    if (!preset || !Object.prototype.hasOwnProperty.call(ROUND_EVENT_PRESETS, preset)) {
      return null;
    }
    return preset;
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await adminApi.getAuditLogs({
          page,
          limit,
          eventType: eventTypeFilter || undefined,
          userId: userIdFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        });

        if (cancelled) return;
        setLogs(response.data.logs);
        setTotal(response.data.pagination.total);
      } catch (err) {
        if (cancelled) return;
        setError(handleApiError(err));
        setLogs([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchLogs();

    return () => {
      cancelled = true;
    };
  }, [page, limit, eventTypeFilter, userIdFilter, fromDate, toDate, refreshKey]);

  const updateQueryParams = (updates: Record<string, string | null>, resetPage = false) => {
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value && value.trim().length > 0) {
          nextParams.set(key, value);
        } else {
          nextParams.delete(key);
        }
      }

      if (resetPage) {
        nextParams.set('page', '1');
      }

      return nextParams;
    });
  };

  const handlePresetFilter = (presetKey: string) => {
    if (selectedPreset === presetKey) {
      updateQueryParams({ preset: null, eventType: null }, true);
    } else {
      const preset = ROUND_EVENT_PRESETS[presetKey];
      updateQueryParams(
        {
          preset: presetKey,
          eventType: preset.eventTypes.join(','),
        },
        true,
      );
    }
  };

  const handleRefresh = () => {
    setRefreshKey((previous) => previous + 1);
  };

  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={Logs} size="lg" className="text-blue-600 dark:text-blue-400" />
          Audit Logs
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Track system events, administrative actions, and application activity.
        </p>
      </header>

      {/* Round Event Filter Presets */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Round Audit Trail</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ROUND_EVENT_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => handlePresetFilter(key)}
              className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                selectedPreset === key
                  ? 'bg-blue-600 text-white dark:bg-blue-700'
                  : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {/* Filter Controls */}
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Additional Filters</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">User ID</label>
            <input
              type="text"
              value={userIdFilter}
              onChange={(e) => {
                updateQueryParams({ userId: e.target.value }, true);
              }}
              placeholder="Filter by user"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                updateQueryParams({ from: e.target.value }, true);
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                updateQueryParams({ to: e.target.value }, true);
              }}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleRefresh}
              variant="secondary"
              className="w-full"
            >
              <Icon icon={RefreshCw} size="sm" />
              Refresh
            </Button>
          </div>
        </div>
      </section>

      {/* Active Filters Display */}
      {(selectedPreset || eventTypeFilter || userIdFilter || fromDate || toDate) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Active filters:</strong>
            {selectedPreset && ` ${ROUND_EVENT_PRESETS[selectedPreset].label}`}
            {userIdFilter && ` | User: ${userIdFilter}`}
            {fromDate && ` | From: ${fromDate}`}
            {toDate && ` | To: ${toDate}`}
          </p>
        </div>
      )}

      {/* Logs Table */}
      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : loading ? (
        <SkeletonTable rows={8} columns={6} />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/60">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Timestamp</TableHeaderCell>
                  <TableHeaderCell>Event Type</TableHeaderCell>
                  <TableHeaderCell>User</TableHeaderCell>
                  <TableHeaderCell>Actor</TableHeaderCell>
                  <TableHeaderCell>IP Address</TableHeaderCell>
                  <TableHeaderCell>Metadata</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      No audit logs match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{formatDate(log.created_at)}</TableCell>
                      <TableCell>
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200">
                          {log.event_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{log.user_id?.substring(0, 8) || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">{log.actor_user_id?.substring(0, 8) || '—'}</TableCell>
                      <TableCell className="text-xs">{log.ip_address || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-blue-600 hover:text-blue-700 dark:text-blue-400">
                              View ({Object.keys(log.metadata).length} fields)
                            </summary>
                            <pre className="mt-2 overflow-auto rounded bg-slate-50 p-2 text-xs dark:bg-slate-900">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Page {page} of {totalPages} ({total} total logs)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (page > 1) {
                      updateQueryParams({ page: String(page - 1) });
                    }
                  }}
                  disabled={page <= 1}
                  className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:bg-slate-700"
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (page < totalPages) {
                      updateQueryParams({ page: String(page + 1) });
                    }
                  }}
                  disabled={page >= totalPages}
                  className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:bg-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogsPage;
