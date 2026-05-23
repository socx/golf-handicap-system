import React, { useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const navigationItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/players', label: 'Players' },
  { to: '/courses', label: 'Courses' },
  { to: '/rounds', label: 'Rounds' },
  { to: '/handicap', label: 'Handicap' },
  { to: '/admin', label: 'Admin' },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'block rounded-xl px-3 py-2 text-sm font-medium transition',
    isActive ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ');

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayRole = useMemo(() => user?.role?.toUpperCase() ?? 'UNKNOWN', [user?.role]);

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 md:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <span className="text-lg">{mobileOpen ? 'x' : '='}</span>
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Golf Handicap System</p>
              <h1 className="text-base font-semibold text-slate-900">Club Operations</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right sm:block">
              <p className="text-xs font-semibold text-slate-500">{displayRole}</p>
              <p className="text-sm text-slate-700">{user?.email || 'unknown user'}</p>
            </div>
            <button
              type="button"
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => void handleLogout()}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside
          className={[
            'fixed inset-y-16 left-0 z-20 w-72 border-r border-slate-200 bg-white px-4 py-5 transition md:static md:inset-auto md:z-auto md:w-64 md:rounded-2xl md:border md:px-3',
            mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
          ].join(' ')}
        >
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Navigation</p>
          <nav className="mt-3 space-y-1">
            {navigationItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={navLinkClass} onClick={() => setMobileOpen(false)}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        {mobileOpen ? (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-10 bg-slate-900/30 md:hidden"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
        ) : null}

        <main className="min-h-[calc(100vh-10rem)] flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <Outlet />
        </main>
      </div>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          Golf Handicap System • Built for player records, rounds, and handicap operations.
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
