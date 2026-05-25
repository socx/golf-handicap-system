import React from 'react';
import { Logo } from '../Logo';
import { useTheme } from '../../context/ThemeContext';

interface AuthAsideStat {
  value: string;
  label: string;
}

interface AuthSplitLayoutProps {
  intro: string;
  introDetail: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  asideBadge: string;
  asideEyebrow: string;
  asideTitle: string;
  asideDescription: string;
  asideStats: AuthAsideStat[];
}

interface AuthStatusCardProps {
  eyebrow?: string;
  title: string;
  description: string;
  tone?: 'default' | 'warning';
  action?: React.ReactNode;
  leading?: React.ReactNode;
}

export const AuthStatusCard: React.FC<AuthStatusCardProps> = ({
  eyebrow,
  title,
  description,
  tone = 'default',
  action,
  leading,
}) => {
  const toneClassName =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50/90 dark:border-amber-900/70 dark:bg-amber-950/40'
      : 'border-slate-200 bg-white/90 dark:border-slate-700 dark:bg-slate-950/85';

  const eyebrowClassName = tone === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-teal-700 dark:text-teal-300';

  return (
    <div className={`rounded-3xl ${toneClassName} p-8 shadow-sm backdrop-blur transition-colors duration-300`}>
      <div className="flex items-start gap-4">
        {leading}
        <div>
          {eyebrow ? (
            <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${eyebrowClassName}`}>{eyebrow}</p>
          ) : null}
          <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-100">{title}</p>
          <p className="mt-4 text-base leading-7 text-slate-700 dark:text-slate-300">{description}</p>
          {action ? <div className="mt-6">{action}</div> : null}
        </div>
      </div>
    </div>
  );
};

export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({
  intro,
  introDetail,
  title,
  description,
  children,
  footer,
  asideBadge,
  asideEyebrow,
  asideTitle,
  asideDescription,
  asideStats,
}) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-transparent transition-colors duration-300 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,46vw)]">
      <section className="flex min-h-screen items-center justify-center px-6 py-12 transition-colors duration-300 sm:px-8 lg:px-12 xl:px-16">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Logo size="sm" showText={false} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700 dark:text-teal-300">Golf Handicap System</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{intro}</p>
              </div>
            </div>

            <button
              type="button"
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              onClick={toggleTheme}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <span className="text-base">{isDark ? '☀' : '☾'}</span>
            </button>
          </div>

          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-100 sm:text-5xl">{title}</h1>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{description}</p>
            {introDetail ? <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{introDetail}</p> : null}
          </div>

          <div className="mt-10">{children}</div>

          {footer ? <div className="mt-8 text-sm leading-6 text-slate-600 dark:text-slate-300">{footer}</div> : null}
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:min-h-screen lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.38),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,0.82)_0%,_rgba(2,6,23,1)_100%)]" />
        <div className="absolute inset-y-0 left-0 w-px bg-white/10" />

        <div className="relative px-10 pt-10 xl:px-14 xl:pt-14">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {asideBadge}
          </div>
        </div>

        <div className="relative px-10 py-12 xl:px-14 xl:py-16">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-300/90">{asideEyebrow}</p>
            <h2 className="mt-6 text-4xl font-semibold tracking-tight text-white xl:text-5xl">{asideTitle}</h2>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300">{asideDescription}</p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {asideStats.map((stat) => (
                <div key={`${stat.value}-${stat.label}`} className="rounded-3xl border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
                  <p className="text-3xl font-semibold text-white">{stat.value}</p>
                  <p className="mt-2 text-sm text-slate-300">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};