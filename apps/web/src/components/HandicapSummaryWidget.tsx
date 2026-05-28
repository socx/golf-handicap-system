import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getHandicapEligibility,
  getHandicapHistory,
  type HandicapEligibilityResponse,
  type HandicapHistoryResponse,
} from '../api/handicap';
import { handleApiError } from '../api/client';

interface HandicapSummaryWidgetProps {
  playerId: string;
}

interface WidgetState {
  loading: boolean;
  error: string | null;
  eligibility: HandicapEligibilityResponse | null;
  history: HandicapHistoryResponse | null;
}

const widgetBaseClass =
  'rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/60';

export const HandicapSummaryWidget: React.FC<HandicapSummaryWidgetProps> = ({ playerId }) => {
  const [state, setState] = useState<WidgetState>({
    loading: true,
    error: null,
    eligibility: null,
    history: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [eligibilityData, historyData] = await Promise.all([
          getHandicapEligibility(playerId),
          getHandicapHistory(playerId),
        ]);

        if (cancelled) return;

        setState({
          loading: false,
          error: null,
          eligibility: eligibilityData,
          history: historyData,
        });
      } catch (err) {
        if (cancelled) return;
        const errorMsg = handleApiError(err);
        setState({
          loading: false,
          error: errorMsg,
          eligibility: null,
          history: null,
        });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  if (state.loading) {
    return (
      <article className={widgetBaseClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Handicap Summary
        </p>
        <div className="mt-4 h-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </article>
    );
  }

  if (state.error) {
    return (
      <article className={widgetBaseClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Handicap Summary
        </p>
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      </article>
    );
  }

  const { eligibility, history } = state;

  if (!eligibility) {
    return (
      <article className={widgetBaseClass}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Handicap Summary
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">No data available</p>
      </article>
    );
  }

  // Check eligibility status
  const isEligible = eligibility.eligibilityStatus === 'eligible';
  const latestRecord = history?.records?.[0];
  const lastUpdateDate = latestRecord
    ? new Date(latestRecord.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <article className={widgetBaseClass}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Handicap Summary
      </p>

      {!isEligible ? (
        <>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold">Status:</span> Insufficient holes
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            {eligibility.minimumRequiredHoles - eligibility.totalEligibleHoles} more holes needed
          </p>
        </>
      ) : (
        <>
          <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {latestRecord?.handicapIndex.toFixed(1) ?? 'N/A'}
          </h3>
          {lastUpdateDate && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Updated: {lastUpdateDate}
            </p>
          )}
        </>
      )}

      <Link
        to={`/handicap/history/${playerId}`}
        className="mt-4 inline-block text-sm font-medium text-teal-700 hover:text-teal-800 dark:text-teal-400 dark:hover:text-teal-300"
      >
        View History →
      </Link>
    </article>
  );
};
