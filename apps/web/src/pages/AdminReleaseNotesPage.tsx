import React, { useEffect, useState } from 'react';
import { releaseNotesApi } from '../api/releaseNotes';
import { handleApiError } from '../api/client';
import MarkdownContent from '../components/MarkdownContent';
import { Button, Card, CardBody, CardHeader } from '../components/ui';
import { showErrorToast, showSuccessToast } from '../lib/toast';

const AdminReleaseNotesPage: React.FC = () => {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await releaseNotesApi.get();
        if (cancelled) return;
        setMarkdown(response.data.markdown);
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

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await releaseNotesApi.update(markdown);
      setMarkdown(response.data.markdown);
      showSuccessToast('Release notes updated', 'The What\'s New page has been updated.');
    } catch (saveError) {
      showErrorToast('Save failed', handleApiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Admin: Release Notes</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Edit markdown content for the public What&apos;s New page.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Editor</h2>
          </CardHeader>
          <CardBody>
            {loading ? <p className="text-sm text-slate-500 dark:text-slate-400">Loading release notes…</p> : null}
            {!loading && error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
            {!loading && !error ? (
              <form onSubmit={handleSave} className="space-y-4">
                <textarea
                  aria-label="Release notes markdown"
                  value={markdown}
                  onChange={(event) => setMarkdown(event.target.value)}
                  className="min-h-[22rem] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save release notes'}
                </Button>
              </form>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Preview</h2>
          </CardHeader>
          <CardBody>
            <MarkdownContent markdown={markdown} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default AdminReleaseNotesPage;
