import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { handleApiError } from '../api/client';
import { type HoleScoreInput, roundsApi } from '../api/rounds';
import { playersApi } from '../api/players';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { ArrowLeft, Save } from '../components/ui/icons';
import { Input } from '../components/ui/Input';
import { CourseSelector } from '../components/ui/CourseSelector';
import { PlayerSelector } from '../components/ui/PlayerSelector';
import { TeeConfigurationSelector } from '../components/ui/TeeConfigurationSelector';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import type { Course, TeeConfiguration } from '../api/courses';
import type { Player } from '../api/players';

interface HoleRow extends HoleScoreInput {
  holeNumber: number;
}

interface ValidationIssue {
  field: string;
  message: string;
}

function buildDefaultHoles(holeCount: 9 | 18): HoleRow[] {
  return Array.from({ length: holeCount }, (_, i) => ({
    holeNumber: i + 1,
    strokes: 0,
    putts: null,
    gir: false,
    fairwayHit: null,
    inSand: false,
    penalties: 0,
  }));
}

function validate(
  player: Player | null,
  teeConfig: TeeConfiguration | null,
  playedAt: string,
  holes: HoleRow[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!player) issues.push({ field: 'player', message: 'Player is required.' });
  if (!teeConfig) issues.push({ field: 'teeConfig', message: 'Tee configuration is required.' });
  if (!playedAt) issues.push({ field: 'playedAt', message: 'Date played is required.' });
  holes.forEach((h) => {
    if (h.strokes < 1) {
      issues.push({ field: `hole_${h.holeNumber}_strokes`, message: `Hole ${h.holeNumber}: strokes must be at least 1.` });
    }
  });
  return issues;
}

const RoundEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPlayerRole = user?.role === 'player';

  const [player, setPlayer] = useState<Player | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [teeConfig, setTeeConfig] = useState<TeeConfiguration | null>(null);
  const [playedAt, setPlayedAt] = useState<string>('');
  const [playingHandicap, setPlayingHandicap] = useState<string>('');
  const [holes, setHoles] = useState<HoleRow[]>(buildDefaultHoles(18));

  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-load player profile for player users
  useEffect(() => {
    if (!isPlayerRole || !user?.player_id) return;

    const loadOwnProfile = async () => {
      try {
        const response = await playersApi.get(user.player_id!);
        setPlayer(response.player);
      } catch (err) {
        const msg = handleApiError(err);
        setPageError(`Failed to load player profile: ${msg}`);
      }
    };

    void loadOwnProfile();
  }, [isPlayerRole, user?.player_id]);

  // When course changes reset tee config
  const handleCourseChange = (c: Course | null) => {
    setCourse(c);
    setTeeConfig(null);
    setHoles(buildDefaultHoles(18));
  };

  const handleTeeConfigurationChange = (config: TeeConfiguration | null) => {
    setTeeConfig(config);
    const holeCount = config?.hole_count === 9 ? 9 : 18;
    setHoles(buildDefaultHoles(holeCount));
  };

  function updateHole<K extends keyof HoleRow>(index: number, field: K, value: HoleRow[K]) {
    setHoles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const issues = validate(player, teeConfig, playedAt, holes);
    if (issues.length > 0) {
      setValidationIssues(issues);
      return;
    }
    setValidationIssues([]);
    setPageError(null);
    setSaving(true);
    try {
      const response = await roundsApi.create({
        playerId: player!.id,
        teeConfigurationId: teeConfig!.id,
        playedAt: new Date(playedAt).toISOString(),
        playingHandicap: playingHandicap !== '' ? Number(playingHandicap) : null,
        holeScores: holes,
      });
      showSuccessToast('Round saved', 'Your scorecard has been submitted.');
      navigate(`/rounds/${response.data.round.id}`);
    } catch (err) {
      const msg = handleApiError(err);
      setPageError(msg);
      showErrorToast('Failed to save round', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Enter Round</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Select a player and tee, then fill in scores for each hole.
        </p>
      </div>

      {pageError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
        >
          {pageError}
        </div>
      )}

      {validationIssues.length > 0 && (
        <div
          role="alert"
          aria-label="Validation errors"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <p className="mb-1 text-sm font-semibold text-amber-800 dark:text-amber-300">
            Please fix the following before saving:
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-sm text-amber-700 dark:text-amber-400">
            {validationIssues.map((issue) => (
              <li key={issue.field}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Player & course selection */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">Player &amp; Course</h3>
          {isPlayerRole && player && (
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Your account is scoped to your own player record.
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PlayerSelector
              value={player}
              onChange={isPlayerRole ? () => {} : setPlayer}
              label="Player"
              disabled={isPlayerRole}
            />
            <CourseSelector value={course} onChange={handleCourseChange} label="Course" />
            <TeeConfigurationSelector
              courseId={course?.id ?? null}
              value={teeConfig}
              onChange={handleTeeConfigurationChange}
              label="Tee configuration"
            />
            <Input
              label="Date played"
              type="date"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              required
            />
          </div>
          <div className="mt-4 max-w-xs">
            <Input
              label="Playing handicap (optional)"
              type="number"
              min={-10}
              max={54}
              value={playingHandicap}
              onChange={(e) => setPlayingHandicap(e.target.value)}
              placeholder="e.g. 18"
            />
          </div>
        </section>

        {/* Hole-by-hole score grid */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100">
            Hole scores ({holes.length} holes)
          </h3>
          <div className="overflow-x-auto">
            <table
              aria-label="Hole scores grid"
              className="w-full min-w-[640px] border-collapse text-sm"
            >
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-3 text-center">Hole</th>
                  <th className="px-3 py-2">Strokes</th>
                  <th className="px-3 py-2">Putts</th>
                  <th className="px-3 py-2 text-center">GIR</th>
                  <th className="px-3 py-2 text-center">Fairway</th>
                  <th className="px-3 py-2 text-center">Sand</th>
                  <th className="px-3 py-2">Penalties</th>
                </tr>
              </thead>
              <tbody>
                {holes.map((hole, idx) => (
                  <tr
                    key={hole.holeNumber}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-700/60"
                  >
                    <td className="py-1.5 pr-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                      {hole.holeNumber}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        aria-label={`Hole ${hole.holeNumber} strokes`}
                        type="number"
                        min={1}
                        max={20}
                        value={hole.strokes === 0 ? '' : hole.strokes}
                        onChange={(e) =>
                          updateHole(idx, 'strokes', e.target.value === '' ? 0 : Number(e.target.value))
                        }
                        className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        required
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        aria-label={`Hole ${hole.holeNumber} putts`}
                        type="number"
                        min={0}
                        max={10}
                        value={hole.putts ?? ''}
                        onChange={(e) =>
                          updateHole(idx, 'putts', e.target.value === '' ? null : Number(e.target.value))
                        }
                        className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        aria-label={`Hole ${hole.holeNumber} GIR`}
                        type="checkbox"
                        checked={hole.gir}
                        onChange={(e) => updateHole(idx, 'gir', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        aria-label={`Hole ${hole.holeNumber} fairway hit`}
                        type="checkbox"
                        checked={hole.fairwayHit ?? false}
                        onChange={(e) => updateHole(idx, 'fairwayHit', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        aria-label={`Hole ${hole.holeNumber} in sand`}
                        type="checkbox"
                        checked={hole.inSand}
                        onChange={(e) => updateHole(idx, 'inSand', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        aria-label={`Hole ${hole.holeNumber} penalties`}
                        type="number"
                        min={0}
                        max={10}
                        value={hole.penalties === 0 ? '' : hole.penalties}
                        onChange={(e) =>
                          updateHole(idx, 'penalties', e.target.value === '' ? 0 : Number(e.target.value))
                        }
                        className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/rounds')}
            disabled={saving}
          >
            <Icon icon={ArrowLeft} size="sm" />
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            <Icon icon={Save} size="sm" />
            {saving ? 'Saving…' : 'Save round'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default RoundEntryPage;
