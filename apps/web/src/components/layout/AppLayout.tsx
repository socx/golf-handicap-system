import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { Icon } from '../ui/Icon';
import { Menu, X, Sun, Moon, LogOut } from '../ui/icons';
import { getFilteredNavigationItems } from './navigationItems';
import { maintenanceApi } from '../../api/maintenance';
import MaintenanceBanner from '../MaintenanceBanner';

const MAINTENANCE_DISMISSED_KEY = 'ghs-maintenance-dismissed-signature';

interface MaintenanceState {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  updatedAt: string | null;
}

const defaultMaintenanceState: MaintenanceState = {
  maintenanceMode: false,
  maintenanceMessage: '',
  updatedAt: null,
};

function getMaintenanceSignature(value: MaintenanceState): string {
  return [value.updatedAt || 'none', value.maintenanceMessage.trim()].join('|');
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceState>(defaultMaintenanceState);
  const [isMaintenanceDismissed, setIsMaintenanceDismissed] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const displayRole = useMemo(() => user?.role?.toUpperCase() ?? 'UNKNOWN', [user?.role]);

  const navigationItems = useMemo(() => getFilteredNavigationItems(user?.role ?? null), [user?.role]);

  useEffect(() => {
    let cancelled = false;

    const loadMaintenance = async () => {
      try {
        const response = await maintenanceApi.getStatus();
        if (cancelled) return;

        const status = response.data;
        const nextState: MaintenanceState = {
          maintenanceMode: status.maintenanceMode,
          maintenanceMessage: status.maintenanceMessage,
          updatedAt: status.updatedAt,
        };

        setMaintenance(nextState);

        const dismissedSignature = window.localStorage.getItem(MAINTENANCE_DISMISSED_KEY);
        setIsMaintenanceDismissed(dismissedSignature === getMaintenanceSignature(nextState));
      } catch {
        if (cancelled) return;
        setMaintenance(defaultMaintenanceState);
      }
    };

    void loadMaintenance();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
  };

  const handleDismissMaintenance = () => {
    const signature = getMaintenanceSignature(maintenance);
    window.localStorage.setItem(MAINTENANCE_DISMISSED_KEY, signature);
    setIsMaintenanceDismissed(true);
  };

  const shouldShowMaintenanceBanner = maintenance.maintenanceMode && !isMaintenanceDismissed;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      {shouldShowMaintenanceBanner ? (
        <MaintenanceBanner message={maintenance.maintenanceMessage} onDismiss={handleDismissMaintenance} />
      ) : null}

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 md:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <Icon icon={X} size="md" /> : <Icon icon={Menu} size="md" />}
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Golf Handicap System</p>
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Club Operations</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              onClick={toggleTheme}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {isDark ? <Icon icon={Sun} size="md" /> : <Icon icon={Moon} size="md" />}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right transition-colors dark:border-slate-700 dark:bg-slate-900 sm:block">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{displayRole}</p>
              <p className="text-sm text-slate-700 dark:text-slate-200">{user?.email || 'unknown user'}</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
              onClick={() => void handleLogout()}
            >
              <Icon icon={LogOut} size="sm" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside
          className={[
            'fixed inset-y-16 left-0 z-20 w-72 border-r border-slate-200 bg-white px-4 py-5 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 md:static md:inset-auto md:z-auto md:w-64 md:rounded-2xl md:border md:px-3',
            mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          ].join(' ')}
        >
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Navigation</p>
          <nav className="mt-3 space-y-1">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin'}
                className={navLinkClass}
                onClick={() => setMobileOpen(false)}
              >
                <Icon icon={item.icon} size="sm" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {mobileOpen ? (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-10 bg-slate-900/30 backdrop-blur-[1px] md:hidden"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
        ) : null}

        <main className="min-h-[calc(100vh-10rem)] flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950 sm:p-6">
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 dark:text-slate-400 sm:px-6 lg:px-8">
          Golf Handicap System • Built for player records, rounds, and handicap operations.
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
