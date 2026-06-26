import React, { useEffect, useState } from 'react';
import { feedbackApi, type FeedbackItem } from '../api/feedback';
import { handleApiError } from '../api/client';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/Table';

const AdminFeedbackPage: React.FC = () => {
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await feedbackApi.listAdmin({ page: 1, limit: 50 });
        if (cancelled) return;
        setFeedback(response.data.feedback);
      } catch (err) {
        if (cancelled) return;
        setError(handleApiError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading feedback...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Admin Feedback Inbox</h2>
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Date</TableHeaderCell>
            <TableHeaderCell>Category</TableHeaderCell>
            <TableHeaderCell>User</TableHeaderCell>
            <TableHeaderCell>Message</TableHeaderCell>
            <TableHeaderCell>Screenshot</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {feedback.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-slate-500">No feedback reports yet.</TableCell>
            </TableRow>
          ) : (
            feedback.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{new Date(item.created_at).toISOString().slice(0, 10)}</TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.user_email || item.user_id.slice(0, 8)}</TableCell>
                <TableCell className="max-w-xl whitespace-pre-wrap">{item.message}</TableCell>
                <TableCell>
                  {item.screenshot_data_url ? (
                    <a href={item.screenshot_data_url} target="_blank" rel="noreferrer" className="text-teal-700 underline">
                      View
                    </a>
                  ) : '—'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AdminFeedbackPage;
