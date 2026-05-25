import { Button } from '../ui/Button';

export interface ErrorFallbackProps {
  error?: Error | null;
  onRetry: () => void;
}

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(13,148,136,0.16),_transparent_32%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-6 py-16 text-slate-900">
      <div className="max-w-xl rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="mb-5 inline-flex rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
          Something went wrong
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">We could not load this part of the app.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Refresh the page to try again. If the problem keeps happening, capture the error details and share them with the team.
        </p>

        {error?.message ? (
          <pre className="mt-5 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            {error.message}
          </pre>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={onRetry}>
            Reload app
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.location.assign('/dashboard')}>
            Go to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ErrorFallback;