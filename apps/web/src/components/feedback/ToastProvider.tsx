import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { subscribeToasts, type ToastMessage, type ToastVariant } from '../../lib/toast';

const variantStyles: Record<ToastVariant, string> = {
  info: 'border-slate-200 bg-white text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={twMerge(
        clsx(
          'pointer-events-auto w-full max-w-sm rounded-2xl border p-4 shadow-lg backdrop-blur-sm',
          variantStyles[toast.variant ?? 'info'],
        ),
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description ? <p className="mt-1 text-sm leading-5 opacity-90">{toast.description}</p> : null}
        </div>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs font-semibold opacity-70 transition hover:opacity-100"
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
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={(id) => setToasts((current) => current.filter((entry) => entry.id !== id))} />
        ))}
      </div>
    </>
  );
}

export default ToastProvider;