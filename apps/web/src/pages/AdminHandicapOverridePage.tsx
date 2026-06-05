import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createHandicapOverride,
  listHandicapOverrides,
  type HandicapOverride,
} from '../api/handicap';
import { playersApi, type Player } from '../api/players';
import {
  Button,
  Input,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui';
import { showErrorToast, showSuccessToast } from '../lib/toast';

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function formatIndex(value: number | null): string {
  return value === null ? '—' : value.toFixed(1);
}

function validateForm(newIndex: string, reason: string): string | null {
  if (!newIndex.trim()) return 'New handicap index is required.';
  const n = Number(newIndex);
  if (!Number.isFinite(n) || n < -10 || n > 54) return 'Index must be between -10 and 54.';
  if (!reason.trim()) return 'Reason is required.';
  return null;
}

const AdminHandicapOverridePage: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();

  const [player, setPlayer] = useState<Player | null>(null);
  const [overrides, setOverrides] = useState<HandicapOverride[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newIndex, setNewIndex] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [playerDetail, overridesData] = await Promise.all([
          playersApi.get(playerId),
          listHandicapOverrides(playerId),
        ]);
        if (cancelled) return;
        setPlayer(playerDetail.player);
        setOverrides(overridesData.overrides);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load data');
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = validateForm(newIndex, reason);
    if (error) {
      setFormError(error);
      return;
    }

    if (!playerId) return;

    setFormError(null);
    setSubmitting(true);
    try {
      const result = await createHandicapOverride(playerId, {
        newIndex: Number(newIndex),
        reason: reason.trim(),
      });
      showSuccessToast('Override applied', `Handicap index set to ${result.override.newIndex.toFixed(1)}.`);
      setNewIndex('');
      setReason('');
      const overridesData = await listHandicapOverrides(playerId);
      setOverrides(overridesData.overrides);
      if (player) {
        setPlayer({ ...player, handicap_index: result.override.newIndex });
      }
    } catch (err) {
      showErrorToast('Override failed', err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (!playerId) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Handicap Override</h2>
        <p className="text-sm text-red-600">Player ID is missing from the URL.</p>
      </div>
    );
  }

  const loading = player === null && overrides === null && !loadError;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Admin</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Handicap Override
            {player ? ` — ${player.first_name} ${player.last_name}` : ''}
          </h2>
          {player && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Current index:{' '}
              <strong data-testid="current-index">{formatIndex(player.handicap_index ?? null)}</strong>
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={() => navigate(`/players/${playerId}`)}>
          Back to Profile
        </Button>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {loadError}
        </div>
      )}

      {/* Override form */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800/60">
        <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Apply manual override</h3>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" aria-label="Handicap override form">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="New handicap index"
              aria-label="New handicap index"
              name="newIndex"
              type="number"
              step="0.1"
              min="-10"
              max="54"
              value={newIndex}
              onChange={(e) => setNewIndex(e.target.value)}
              placeholder="e.g. 14.2"
            />
            <Input
              label="Reason"
              aria-label="Reason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the override is being applied"
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Applying…' : 'Apply override'}
            </Button>
          </div>
        </form>
      </section>

      {/* Override history */}
      <section>
        <h3 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Override history</h3>
        {loading ? (
          <SkeletonTable rows={4} columns={5} />
        ) : overrides && overrides.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No overrides have been applied yet.</p>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Previous</TableHeaderCell>
                <TableHeaderCell>New index</TableHeaderCell>
                <TableHeaderCell>Reason</TableHeaderCell>
                <TableHeaderCell>Admin</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {overrides?.map((override) => (
                <TableRow key={override.id}>
                  <TableCell>{formatDate(override.createdAt)}</TableCell>
                  <TableCell>{formatIndex(override.previousIndex)}</TableCell>
                  <TableCell>{formatIndex(override.newIndex)}</TableCell>
                  <TableCell>{override.reason}</TableCell>
                  <TableCell>{override.adminEmail ?? override.adminUserId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
};

export default AdminHandicapOverridePage;
