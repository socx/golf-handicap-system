import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { handleApiError } from '../api/client';
import { roundsApi, type RoundDetailResponse } from '../api/rounds';
import { Button } from '../components/ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/Table';
import { SkeletonTable } from '../components/ui/Skeleton';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function formatNullableNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : String(value);
}

const RoundScorecardPage: React.FC = () => {
  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<RoundDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roundId) return;

    let cancelled = false;

    const fetchRound = async () => {
      try {
        const response = await roundsApi.get(roundId);
        if (cancelled) return;
        setData(response.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(handleApiError(err));
      }
    };

    void fetchRound();

    return () => {
      cancelled = true;
    };
  }, [roundId]);

  const loading = !!roundId && !data && !error;

  if (!roundId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Scorecard</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Round ID is missing.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/rounds')}>
            Back to Rounds
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200/90" />
            <div className="h-4 w-72 animate-pulse rounded-lg bg-slate-200/90" />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-200/90" />
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`metric-skel-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="h-3 w-16 animate-pulse rounded bg-slate-200/90" />
              <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-200/90" />
            </div>
          ))}
        </div>
        <SkeletonTable rows={9} columns={8} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Scorecard</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Review round details and per-hole performance.</p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/rounds')}>
            Back to Rounds
          </Button>
        </div>
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error ?? 'Round not found'}
        </div>
      </div>
    );
  }

  const { round, teeConfiguration, holeScores } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Scorecard</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{round.id}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Played on {formatDate(round.playedAt)} at {teeConfiguration.courseName}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/rounds')}>
          Back to Rounds
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tee Configuration</h3>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Name</dt>
              <dd data-testid="tee-name" className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{teeConfiguration.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Colour</dt>
              <dd data-testid="tee-colour" className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{teeConfiguration.teeColour}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Course</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{teeConfiguration.courseName}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Holes</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{teeConfiguration.holeCount}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Rating</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatNullableNumber(teeConfiguration.courseRating)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Slope</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatNullableNumber(teeConfiguration.slopeRating)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60 md:col-span-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Round Totals</h3>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Gross</dt>
              <dd data-testid="gross-score" className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{round.grossScore}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Adjusted</dt>
              <dd data-testid="adjusted-score" className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{round.adjustedGrossScore}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Putts</dt>
              <dd data-testid="putts-total" className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{round.totals.putts}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">GIR</dt>
              <dd data-testid="gir-total" className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{round.totals.gir}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">FIR</dt>
              <dd data-testid="fir-total" className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{round.totals.fairwaysHit}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Penalties</dt>
              <dd data-testid="penalties-total" className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{round.totals.penalties}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60 md:col-span-2 xl:col-span-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Round Metadata</h3>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Played At</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatDate(round.playedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Playing Handicap</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{formatNullableNumber(round.playingHandicap)}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">9 Hole</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{round.flags.is9Hole ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Tournament</dt>
              <dd className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{round.flags.isTournament ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/60">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Hole-by-hole breakdown</h3>
          <span className="text-sm text-slate-500 dark:text-slate-400">{holeScores.length} holes</span>
        </div>

        <div className="space-y-3 md:hidden" aria-label="Mobile scorecard grid">
          {holeScores.map((hole) => (
            <article key={hole.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">Hole {hole.holeNumber}</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Net adjusted {hole.netDoubleBogeyAdjusted}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{hole.strokes} strokes</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatNullableNumber(hole.putts)} putts</p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">GIR</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">{hole.gir ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">FIR</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">{hole.fairwayHit === null ? '—' : hole.fairwayHit ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Sand</dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100">{hole.inSand ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="hidden md:block" aria-label="Desktop scorecard grid">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Hole</TableHeaderCell>
                <TableHeaderCell>Strokes</TableHeaderCell>
                <TableHeaderCell>Putts</TableHeaderCell>
                <TableHeaderCell>GIR</TableHeaderCell>
                <TableHeaderCell>FIR</TableHeaderCell>
                <TableHeaderCell>Sand</TableHeaderCell>
                <TableHeaderCell>Penalties</TableHeaderCell>
                <TableHeaderCell>Net Adj.</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holeScores.map((hole) => (
                <TableRow key={hole.id}>
                  <TableCell className="font-semibold text-slate-900 dark:text-slate-100">{hole.holeNumber}</TableCell>
                  <TableCell>{hole.strokes}</TableCell>
                  <TableCell>{formatNullableNumber(hole.putts)}</TableCell>
                  <TableCell>{hole.gir ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{hole.fairwayHit === null ? '—' : hole.fairwayHit ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{hole.inSand ? 'Yes' : 'No'}</TableCell>
                  <TableCell>{hole.penalties}</TableCell>
                  <TableCell>{hole.netDoubleBogeyAdjusted}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
};

export default RoundScorecardPage;
