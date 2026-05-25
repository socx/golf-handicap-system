import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shape?: 'rect' | 'circle';
}

export function Skeleton({ className, shape = 'rect', ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={twMerge(
        clsx('animate-pulse bg-slate-200/90', shape === 'circle' ? 'rounded-full' : 'rounded-lg', className),
      )}
      {...props}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  return (
    <div className={clsx('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={`skeleton-line-${index}`}
          className={index === lines - 1 ? 'h-4 w-3/4' : 'h-4 w-full'}
        />
      ))}
    </div>
  );
}

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={twMerge(clsx('rounded-2xl border border-slate-200 bg-white p-5 shadow-sm', className))}>
      <div className="flex items-center gap-4">
        <Skeleton shape="circle" className="h-12 w-12 shrink-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export interface SkeletonListProps {
  items?: number;
  className?: string;
}

export function SkeletonList({ items = 4, className = '' }: SkeletonListProps) {
  return (
    <div className={twMerge(clsx('space-y-4', className))}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={`skeleton-list-${index}`} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <Skeleton shape="circle" className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 4, className = '' }: SkeletonTableProps) {
  return (
    <div className={twMerge(clsx('overflow-hidden rounded-2xl border border-slate-200 bg-white', className))}>
      <div className="grid gap-px bg-slate-200" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <div key={`skeleton-table-head-${index}`} className="bg-slate-50 px-4 py-3">
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`skeleton-table-row-${rowIndex}`} className="grid gap-px bg-slate-100" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {Array.from({ length: columns }).map((__, columnIndex) => (
              <div key={`skeleton-table-cell-${rowIndex}-${columnIndex}`} className="bg-white px-4 py-4">
                <Skeleton className={columnIndex === columns - 1 ? 'h-9 w-20' : 'h-4 w-4/5'} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface SkeletonFormProps {
  fields?: number;
  className?: string;
}

export function SkeletonForm({ fields = 4, className = '' }: SkeletonFormProps) {
  return (
    <div className={twMerge(clsx('rounded-2xl border border-slate-200 bg-white p-6', className))}>
      <div className="space-y-5">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={`skeleton-form-field-${index}`} className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}