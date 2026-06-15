import React from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { ShieldCheck, UserCog, ClipboardCheck, SlidersHorizontal, Plus, Logs } from '../components/ui/icons';

const adminCards = [
  {
    to: '/admin/users',
    title: 'Users',
    description: 'Manage account status and activate or deactivate users.',
    icon: UserCog,
  },
  {
    to: '/admin/players',
    title: 'Players',
    description: 'Create linked user+player accounts, edit players, and manage user links.',
    icon: UserCog,
  },
  {
    to: '/admin/rounds',
    title: 'Rounds',
    description: 'Review pending rounds and approve or reject submitted scorecards.',
    icon: ClipboardCheck,
  },
  {
    to: '/admin/audit-logs',
    title: 'Audit Logs',
    description: 'Track system events, user actions, and application activity with round event presets.',
    icon: Logs,
  },
  {
    to: '/admin/settings',
    title: 'Settings',
    description: 'Configure system-level options for notifications, PCC, and maintenance mode.',
    icon: SlidersHorizontal,
  },
] as const;

const AdminHomePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={ShieldCheck} size="lg" className="text-teal-600 dark:text-teal-400" />
          Admin Console
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Manage operational workflows for users, players, rounds, and system settings.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/admin/players"
          className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <Icon icon={Plus} size="sm" />
          Create user + player
        </Link>
        <Link
          to="/admin/rounds"
          className="inline-flex items-center gap-2 rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <Icon icon={ClipboardCheck} size="sm" />
          Review rounds
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminCards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-xl border border-slate-200 p-4 transition hover:border-teal-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-teal-700"
          >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <Icon icon={card.icon} size="sm" className="text-teal-600 dark:text-teal-400" />
              {card.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{card.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
};

export default AdminHomePage;
