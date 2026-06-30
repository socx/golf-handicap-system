import React, { useEffect, useState } from 'react';
import { adminSystemHealthApi, type AdminSystemHealthResponse, type HealthModuleStatus } from '../api/adminSystemHealth';
import { handleApiError, normalizeApiError } from '../api/client';
import { Icon } from '../components/ui/Icon';
import { Activity, RefreshCw } from '../components/ui/icons';
import { Button } from '../components/ui/Button';

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

const MODULE_LABELS: Array<{ key: keyof AdminSystemHealthResponse['modules']; label: string }> = [
  { key: 'database', label: 'Database' },
  { key: 'cache', label: 'Cache' },
  { key: 'objectStorage', label: 'Object Storage' },
  { key: 'queue', label: 'Queue' },
];

const statusPillClass = (status: HealthModuleStatus['status']) =>
  status === 'ok'
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';

const AdminSystemHealthPage: React.FC = () => {
  const [health, setHealth] = useState<AdminSystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = async ({ isRefresh = false }: { isRefresh?: boolean } = {}) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError(null);
      const response = await adminSystemHealthApi.get();
      setHealth(response.data);
    } catch (err) {
      const apiError = normalizeApiError(err);
      if (apiError.code === 'forbidden_super_admin') {
        setError('Super-admin access is required to view system health.');
      } else {
        setError(handleApiError(err));
      }
      setHealth(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadHealth();
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={Activity} size="lg" className="text-teal-600 dark:text-teal-400" />
          System Health
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Live status of platform services and integrations.
        </p>
      </header>

      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          {health
            ? `Last checked: ${new Date(health.checkedAt).toLocaleString()} • API uptime: ${formatUptime(health.api.uptimeSeconds)}`
            : 'System metrics unavailable'}
        </div>
        <Button onClick={() => void loadHealth({ isRefresh: true })} variant="secondary" disabled={refreshing}>
          <Icon icon={RefreshCw} size="sm" className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
          Loading system health...
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {!loading && !error && health ? (
        <section className="grid gap-4 md:grid-cols-2">
          {MODULE_LABELS.map((module) => {
            const moduleStatus = health.modules[module.key];
            const detailEntries = Object.entries(moduleStatus.details);

            return (
              <article
                key={module.key}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{module.label}</h2>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${statusPillClass(moduleStatus.status)}`}>
                    {moduleStatus.status}
                  </span>
                </div>

                <dl className="space-y-2 text-sm">
                  {detailEntries.map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400">{key}</dt>
                      <dd className="max-w-[60%] truncate text-right text-slate-800 dark:text-slate-100" title={formatDetailValue(value)}>
                        {formatDetailValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </section>
      ) : null}
    </div>
  );
};

export default AdminSystemHealthPage;
