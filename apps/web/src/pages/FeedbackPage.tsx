import React, { useState } from 'react';
import { feedbackApi, type FeedbackCategory } from '../api/feedback';
import { Button } from '../components/ui/Button';
import { showErrorToast, showSuccessToast } from '../lib/toast';

const categories: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature request' },
  { value: 'ui', label: 'UI/UX' },
  { value: 'other', label: 'Other' },
];

const FeedbackPage: React.FC = () => {
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setScreenshotDataUrl(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      showErrorToast('Invalid file', 'Please upload an image file.');
      return;
    }

    if (file.size > 1024 * 1024) {
      showErrorToast('File too large', 'Please upload an image under 1MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setScreenshotDataUrl(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (message.trim().length < 5) {
      showErrorToast('Message too short', 'Please provide at least 5 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await feedbackApi.submit({
        category,
        message: message.trim(),
        screenshotDataUrl,
      });
      setMessage('');
      setScreenshotDataUrl(null);
      showSuccessToast('Feedback sent', 'Thanks for your feedback.');
    } catch {
      showErrorToast('Submission failed', 'Unable to submit feedback right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Feedback</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Submit suggestions or issues directly from the app.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Category</label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {categories.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Message</label>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            placeholder="Describe your issue or suggestion"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Screenshot (optional)</label>
          <input type="file" accept="image/*" onChange={handleFileSelect} />
          {screenshotDataUrl ? <p className="mt-1 text-xs text-slate-500">Screenshot attached</p> : null}
        </div>

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit feedback'}
        </Button>
      </form>
    </div>
  );
};

export default FeedbackPage;
