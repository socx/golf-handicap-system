import React from 'react';

interface SectionPlaceholderPageProps {
  title: string;
  description: string;
}

export const SectionPlaceholderPage: React.FC<SectionPlaceholderPageProps> = ({ title, description }) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Coming Next</p>
    <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
    <p className="mt-3 max-w-2xl text-sm text-slate-600">{description}</p>
  </div>
);

export default SectionPlaceholderPage;
