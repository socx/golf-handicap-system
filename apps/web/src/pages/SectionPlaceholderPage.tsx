import React from 'react';
import { SkeletonCard, SkeletonForm, SkeletonList } from '../components/ui/Skeleton';

interface SectionPlaceholderPageProps {
  title: string;
  description: string;
}

export const SectionPlaceholderPage: React.FC<SectionPlaceholderPageProps> = ({ title, description }) => (
  <div className="space-y-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/40">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Coming Next</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <SkeletonForm />
      <SkeletonList items={4} />
    </div>
  </div>
);

export default SectionPlaceholderPage;
