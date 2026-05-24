import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table
          ref={ref}
          className={twMerge(clsx('w-full text-left text-sm', className))}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  }
);

Table.displayName = 'Table';

export interface TableHeadProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export const TableHead = React.forwardRef<HTMLTableSectionElement, TableHeadProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={twMerge(clsx('bg-slate-50 border-b border-slate-200', className))}
        {...props}
      >
        {children}
      </thead>
    );
  }
);

TableHead.displayName = 'TableHead';

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <tbody ref={ref} className={className} {...props}>
        {children}
      </tbody>
    );
  }
);

TableBody.displayName = 'TableBody';

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  striped?: boolean;
  hover?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ children, className, striped = true, hover = true, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={twMerge(
          clsx(
            'border-b border-slate-200 last:border-b-0',
            striped && 'odd:bg-white even:bg-slate-50',
            hover && 'hover:bg-teal-50 transition-colors',
            className
          )
        )}
        {...props}
      >
        {children}
      </tr>
    );
  }
);

TableRow.displayName = 'TableRow';

export interface TableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
  sortable?: boolean;
  sorted?: 'asc' | 'desc';
  onSort?: () => void;
}

export const TableHeaderCell = React.forwardRef<HTMLTableCellElement, TableHeaderCellProps>(
  ({ children, className, sortable = false, sorted, onSort, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={twMerge(
          clsx(
            'px-6 py-3 font-semibold text-slate-900',
            sortable && 'cursor-pointer hover:bg-slate-100 select-none',
            className
          )
        )}
        onClick={sortable ? onSort : undefined}
        {...props}
      >
        <div className="flex items-center gap-2">
          {children}
          {sortable && sorted && (
            <svg
              className={clsx('w-4 h-4', sorted === 'desc' && 'rotate-180')}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M3 8a1 1 0 011-1h12a1 1 0 011 1v.01a1 1 0 01-1 1H4a1 1 0 01-1-1V8z" />
              <path d="M3 13a1 1 0 011-1h4a1 1 0 011 1v.01a1 1 0 01-1 1H4a1 1 0 01-1-1v-.01z" />
            </svg>
          )}
        </div>
      </th>
    );
  }
);

TableHeaderCell.displayName = 'TableHeaderCell';

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children: React.ReactNode;
}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={twMerge(clsx('px-6 py-4 text-slate-700', className))}
        {...props}
      >
        {children}
      </td>
    );
  }
);

TableCell.displayName = 'TableCell';
