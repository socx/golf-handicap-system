export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

type ToastListener = (toast: ToastMessage) => void;

const listeners = new Set<ToastListener>();

function createToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function subscribeToasts(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showToast(toast: Omit<ToastMessage, 'id'>): ToastMessage {
  const entry: ToastMessage = {
    id: createToastId(),
    durationMs: 5000,
    variant: 'info',
    ...toast,
  };

  listeners.forEach((listener) => listener(entry));
  return entry;
}

export function showErrorToast(title: string, description: string): ToastMessage {
  return showToast({
    title,
    description,
    variant: 'error',
  });
}