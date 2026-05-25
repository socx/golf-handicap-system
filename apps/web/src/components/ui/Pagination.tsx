import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  maxButtons?: number;
}

const sizeStyles = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-3 py-2 text-base',
  lg: 'px-4 py-2.5 text-lg',
};

export const Pagination = React.forwardRef<HTMLDivElement, PaginationProps>(
  (
    {
      currentPage,
      totalPages,
      onPageChange,
      loading = false,
      size = 'md',
      maxButtons = 5,
      className,
      ...props
    },
    ref
  ) => {
    if (totalPages <= 1) return null;

    const getPageButtons = () => {
      const buttons: (number | string)[] = [];
      let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
      let end = Math.min(totalPages, start + maxButtons - 1);

      if (end - start + 1 < maxButtons) {
        start = Math.max(1, end - maxButtons + 1);
      }

      if (start > 1) {
        buttons.push(1);
        if (start > 2) buttons.push('...');
      }

      for (let i = start; i <= end; i++) {
        buttons.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) buttons.push('...');
        buttons.push(totalPages);
      }

      return buttons;
    };

    const pageButtons = getPageButtons();

    const ButtonGroup = ({ children }: { children: React.ReactNode }) => (
      <div className="flex items-center gap-1">{children}</div>
    );

    const PaginationButton = ({
      page,
      onClick,
    }: {
      page: number | string;
      onClick?: () => void;
    }) => {
      const isActive = page === currentPage;
      const isEllipsis = page === '...';

      if (isEllipsis) {
        return (
            <span className="px-2 py-1 text-slate-500 dark:text-slate-400">
            {page}
          </span>
        );
      }

      return (
        <button
          onClick={onClick}
          disabled={loading || isActive}
          className={twMerge(
            clsx(
              'rounded-md border transition-colors duration-200 font-medium disabled:cursor-not-allowed',
              sizeStyles[size],
              isActive
                ? 'bg-teal-600 text-white border-teal-600 dark:bg-teal-500 dark:border-teal-500 dark:text-slate-950'
                : 'border-slate-300 text-slate-900 hover:border-teal-600 hover:text-teal-600 active:bg-teal-50 dark:border-slate-700 dark:text-slate-100 dark:hover:border-teal-400 dark:hover:text-teal-300 dark:active:bg-slate-800'
            )
          )}
        >
          {page}
        </button>
      );
    };

    return (
      <div
        ref={ref}
        className={twMerge(
          clsx('flex items-center justify-between gap-4', className)
        )}
        {...props}
      >
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          className={twMerge(
            clsx(
              'rounded-md border px-3 py-2 transition-colors duration-200 disabled:cursor-not-allowed',
              currentPage === 1
                ? 'border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600'
                : 'border-slate-300 text-slate-900 hover:border-teal-600 hover:text-teal-600 dark:border-slate-700 dark:text-slate-100 dark:hover:border-teal-400 dark:hover:text-teal-300'
            )
          )}
          aria-label="Previous page"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        <ButtonGroup>
          {pageButtons.map((page, idx) => (
            <PaginationButton
              key={idx}
              page={page}
              onClick={
                page !== '...' ? () => onPageChange(page as number) : undefined
              }
            />
          ))}
        </ButtonGroup>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          className={twMerge(
            clsx(
              'rounded-md border px-3 py-2 transition-colors duration-200 disabled:cursor-not-allowed',
              currentPage === totalPages
                ? 'border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600'
                : 'border-slate-300 text-slate-900 hover:border-teal-600 hover:text-teal-600 dark:border-slate-700 dark:text-slate-100 dark:hover:border-teal-400 dark:hover:text-teal-300'
            )
          )}
          aria-label="Next page"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    );
  }
);

Pagination.displayName = 'Pagination';
