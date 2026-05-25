import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps {
  label?: string;
  error?: string;
  hint?: string;
  size?: InputSize;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  name?: string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  value?: string | number | readonly string[];
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  id?: string;
  className?: string;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  pattern?: string;
}

const sizeStyles: Record<InputSize, string> = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-3 py-2 text-base',
  lg: 'px-4 py-3 text-lg',
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      size = 'md',
      prefix,
      suffix,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;

    const inputClass = twMerge(
      clsx(
        'w-full rounded-md border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950',
        sizeStyles[size],
        hasError
          ? 'border-red-500 bg-red-50 text-slate-900 dark:bg-red-950/40 dark:text-slate-100'
          : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400 focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-slate-500',
        disabled && 'bg-slate-100 text-slate-500 cursor-not-allowed dark:bg-slate-900 dark:text-slate-500',
        (prefix || suffix) && 'pl-10 pr-3',
        className
      )
    );

    return (
      <div className="w-full">
        {label && (
          <label className={clsx('mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300', disabled && 'text-slate-500')}>
            {label}
          </label>
        )}
        <div className="relative">
          {prefix && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none dark:text-slate-400">
              {prefix}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            className={inputClass}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none dark:text-slate-400">
              {suffix}
            </div>
          )}
        </div>
        {hasError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
        {hint && !hasError && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
