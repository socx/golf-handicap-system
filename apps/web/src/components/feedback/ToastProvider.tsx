import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToasts, type ToastMessage, type ToastVariant } from '../../lib/toast';

const variantStyles: Record<ToastVariant, string> = {
  info: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/45 dark:text-emerald-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/45 dark:text-amber-200',
  error: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/70 dark:bg-red-950/45 dark:text-red-200',
};

const variantIcons: Record<ToastVariant, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  error: '×',
};

function getAriaRole(variant: ToastVariant): 'status' | 'alert' {
  return variant === 'error' || variant === 'warning' ? 'alert' : 'status';
}

function getAriaLive(variant: ToastVariant): 'polite' | 'assertive' {
  return variant === 'error' || variant === 'warning' ? 'assertive' : 'polite';
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  const variant = toast.variant ?? 'info';

  return (
    <div
      role={getAriaRole(variant)}
      aria-live={getAriaLive(variant)}
      aria-atomic="true"
      className={twMerge(
        clsx(
          'pointer-events-auto w-full max-w-sm rounded-2xl border p-4 shadow-lg backdrop-blur-sm transition-all duration-300',
          variantStyles[variant],
        ),
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/20 text-xs font-bold">
            {variantIcons[variant]}
          </span>
          <p className="text-sm font-semibold">{toast.title}</p>
          <div>
            {toast.description ? <p className="mt-1 text-sm leading-5 opacity-90">{toast.description}</p> : null}
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs font-semibold opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
          onClick={() => onDismiss(toast.id)}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: React.PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts((toast) => {
    setToasts((current) => [toast, ...current].slice(0, 4));
  }), []);

  useEffect(() => {
    if (toasts.length === 0) return undefined;

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        setToasts((current) => current.filter((entry) => entry.id !== toast.id));
      }, toast.durationMs ?? 5000),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts]);

  return (
    <>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6"
        aria-label="Notifications"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={(id) => setToasts((current) => current.filter((entry) => entry.id !== id))} />
        ))}
      </div>
    </>
  );
}

export default ToastProvider;