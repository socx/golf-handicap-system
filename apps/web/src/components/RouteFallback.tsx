import React from 'react';

export const RouteFallback: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-600 shadow-sm">
      Loading...
    </div>
  </div>
);

export default RouteFallback;