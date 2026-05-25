const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3005/api';

export interface ClientErrorReport {
  source: string;
  message: string;
  stack?: string;
  name?: string;
  path?: string;
  code?: string;
  statusCode?: number;
  userAgent?: string;
  componentStack?: string | null;
}

export function reportClientError(report: ClientErrorReport): void {
  void fetch(`${API_URL}/client-errors`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(report),
    keepalive: true,
  }).catch(() => {
    // Logging must never interfere with the user experience.
  });
}