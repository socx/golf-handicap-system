import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hoverable?: boolean;
  border?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, hoverable = false, border = true, ...props }, ref) => {
    const cardClass = twMerge(
      clsx(
        'rounded-lg bg-white transition-colors duration-300 dark:bg-slate-950',
        border ? 'border border-slate-200 dark:border-slate-800' : 'shadow-md',
        hoverable && 'hover:shadow-lg hover:border-slate-300 cursor-pointer dark:hover:border-slate-700',
        className
      )
    );

    return (
      <div ref={ref} className={cardClass} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  divider?: boolean;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className, divider = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx('px-6 py-4', divider && 'border-b border-slate-200 dark:border-slate-800', className)
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div ref={ref} className={twMerge(clsx('px-6 py-4 text-slate-700 dark:text-slate-300', className))} {...props}>
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(
          clsx('px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg dark:border-slate-800 dark:bg-slate-900', className)
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';
