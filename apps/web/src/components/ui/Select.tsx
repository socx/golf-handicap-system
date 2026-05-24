import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type SelectSize = 'sm' | 'md' | 'lg';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  error?: string;
  hint?: string;
  size?: SelectSize;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
  id?: string;
  className?: string;
  required?: boolean;
}

const sizeStyles: Record<SelectSize, string> = {
  sm: 'px-2.5 py-1.5 text-sm',
  md: 'px-3 py-2 text-base',
  lg: 'px-4 py-3 text-lg',
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      size = 'md',
      options,
      placeholder,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;

    const selectClass = twMerge(
      clsx(
        'w-full rounded-md border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 appearance-none cursor-pointer pr-8',
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
        <div className="relative">
          <select ref={ref} disabled={disabled} className={selectClass} {...props}>
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
        {hasError && <p className="mt-1 text-sm text-red-600">{error}</p>}
        {hint && !hasError && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
