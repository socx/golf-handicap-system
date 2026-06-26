import React from 'react';

interface MaintenanceBannerProps {
  message: string;
  onDismiss: () => void;
}

const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({ message, onDismiss }) => {
  return (
    <div
      className="border-b border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <p className="font-medium">Maintenance mode: {message}</p>
        <button
          type="button"
          className="rounded-md border border-amber-500 px-2 py-1 text-xs font-semibold transition-colors hover:bg-amber-200 dark:border-amber-500 dark:hover:bg-amber-900"
          onClick={onDismiss}
          aria-label="Dismiss maintenance banner"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default MaintenanceBanner;
