import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type DatePickerSize = 'sm' | 'md' | 'lg';

export interface DatePickerProps {
  label?: string;
  error?: string;
  hint?: string;
  size?: DatePickerSize;
  min?: string;
  max?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  id?: string;
  className?: string;
  required?: boolean;
}

const sizeStyles: Record<DatePickerSize, string> = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-3 py-2 text-base',
  lg: 'px-4 py-3 text-lg',
};

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    {
      label,
      error,
      hint,
      size = 'md',
      className,
      disabled,
      min,
      max,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;

    const inputClass = twMerge(
      clsx(
        'w-full rounded-md border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2',
        sizeStyles[size],
        hasError
          ? 'border-red-500 bg-red-50'
          : 'border-slate-300 bg-white hover:border-slate-400 focus:border-teal-500',
        disabled && 'bg-slate-100 text-slate-500 cursor-not-allowed',
        className
      )
    );

    return (
      <div className="w-full">
        {label && (
          <label className={clsx('block text-sm font-medium mb-2', disabled && 'text-slate-500')}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="date"
          disabled={disabled}
          min={min}
          max={max}
          className={inputClass}
          {...props}
        />
        {hasError && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {hint && !hasError && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';
