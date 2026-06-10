import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { handleApiError } from '../api/client';
import { playersApi, type Player, type PlayerDetail } from '../api/players';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Pencil, ArrowLeft } from '../components/ui/icons';
import { SkeletonForm } from '../components/ui/Skeleton';
import { HandicapSummaryWidget } from '../components/HandicapSummaryWidget';

export const PlayerProfilePage: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();

  const [player, setPlayer] = useState<Player | null>(null);
  const [playerDetail, setPlayerDetail] = useState<PlayerDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const detail = await playersApi.get(playerId);
        if (cancelled) return;
        setPlayer(detail.player);
        setPlayerDetail(detail);
      } catch (err) {
        if (cancelled) return;
        setLoadError(handleApiError(err));
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (!playerId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Player Profile</h2>
          <Button variant="secondary" onClick={() => navigate('/players')}>
            Back to Players
          </Button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-400">Player ID is missing.</p>
        </div>
      </div>
    );
  }

  const loading = !player && !loadError;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Player Profile</h2>
          <Button variant="secondary" onClick={() => navigate('/players')}>
            Back to Players
          </Button>
        </div>
        <SkeletonForm />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Player Profile</h2>
          <Button variant="secondary" onClick={() => navigate('/players')}>
            Back to Players
          </Button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
          <p className="text-sm text-red-700 dark:text-red-400">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Player Profile</h2>
          <Button variant="secondary" onClick={() => navigate('/players')}>
            Back to Players
          </Button>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-400">Player not found.</p>
        </div>
      </div>
    );
  }

  const normalizedHandicap = playerDetail?.handicap_summary.current_handicap_index;
  const handicapDisplay = normalizedHandicap === null || normalizedHandicap === undefined
    ? 'N/A'
    : typeof normalizedHandicap === 'number'
      ? normalizedHandicap.toFixed(1)
      : normalizedHandicap;

  const handicapLastUpdate = playerDetail?.handicap_summary.last_handicap_update_date
    ? new Date(playerDetail.handicap_summary.last_handicap_update_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'N/A';

  const roundCount = playerDetail?.round_stats.round_count ?? 0;
  const roundLastDate = playerDetail?.round_stats.last_round_date
    ? new Date(playerDetail.round_stats.last_round_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'N/A';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {player.first_name} {player.last_name}
          </h2>
          {player.club && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{player.club}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(`/players/${playerId}/edit`)}>
            <Icon icon={Pencil} size="sm" />
            Edit Profile
          </Button>
          <Button variant="secondary" onClick={() => navigate('/players')}>
            <Icon icon={ArrowLeft} size="sm" />
            Back
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <HandicapSummaryWidget playerId={playerId} />

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Player Information
          </p>
          <div className="mt-4 space-y-3 text-sm">
            {player.email && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Email</p>
                <p className="mt-1 text-slate-900 dark:text-slate-100">{player.email}</p>
              </div>
            )}
            {player.country && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Country</p>
                <p className="mt-1 text-slate-900 dark:text-slate-100">{player.country}</p>
              </div>
            )}
            {player.dob && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date of Birth</p>
                <p className="mt-1 text-slate-900 dark:text-slate-100">
                  {new Date(player.dob).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}
            {player.gender && (
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Gender</p>
                <p className="mt-1 text-slate-900 dark:text-slate-100">{player.gender}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Performance Snapshot
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Current Handicap Index</p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">{handicapDisplay}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Last Handicap Update</p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">{handicapLastUpdate}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Rounds Recorded</p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">{roundCount}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Last Round Date</p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">{roundLastDate}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Account Information
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Created</p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">
                {new Date(player.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Last Updated</p>
              <p className="mt-1 text-slate-900 dark:text-slate-100">
                {new Date(player.updated_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerProfilePage;
