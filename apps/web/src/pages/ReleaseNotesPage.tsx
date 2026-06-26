import React, { useEffect, useState } from 'react';
import MarkdownContent from '../components/MarkdownContent';
import { Card, CardBody, CardHeader } from '../components/ui';
import { releaseNotesApi } from '../api/releaseNotes';
import { handleApiError } from '../api/client';

const ReleaseNotesPage: React.FC = () => {
  const [markdown, setMarkdown] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await releaseNotesApi.get();
        if (cancelled) return;
        setMarkdown(response.data.markdown);
        setUpdatedAt(response.data.updatedAt);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(handleApiError(loadError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">What&apos;s New</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Recent product updates, improvements, and fixes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Release Notes</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {updatedAt ? `Updated ${new Date(updatedAt).toLocaleString()}` : 'No publish date yet'}
            </p>
          </div>
        </CardHeader>
        <CardBody>
          {loading ? <p className="text-sm text-slate-500 dark:text-slate-400">Loading release notes…</p> : null}
          {!loading && error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          {!loading && !error ? <MarkdownContent markdown={markdown} /> : null}
        </CardBody>
      </Card>
    </div>
  );
};

export default ReleaseNotesPage;
