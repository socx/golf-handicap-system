import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleApiError } from '../api/client';
import { coursesApi, type Course, type TeeConfiguration } from '../api/courses';
import {
  roundsApi,
  type RoundImportQueuedResponse,
  type RoundImportSyncResponse,
  type RoundListItem,
} from '../api/rounds';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Modal,
  Pagination,
  Select,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { ClipboardList, CheckCircle, XCircle } from '../components/ui/icons';
import { showErrorToast, showSuccessToast } from '../lib/toast';

const PAGE_SIZE = 10;
const SMALL_IMPORT_THRESHOLD = 100;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

function formatPlayer(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function getStatusTone(status: string | undefined): string {
  switch (status) {
    case 'approved':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
  }
}

const AdminRoundsPage: React.FC = () => {
  const navigate = useNavigate();
  const [rounds, setRounds] = useState<RoundListItem[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teeConfigurations, setTeeConfigurations] = useState<TeeConfiguration[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTeeConfigurationId, setSelectedTeeConfigurationId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [error, setError] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rejectingRound, setRejectingRound] = useState<RoundListItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [importCsvText, setImportCsvText] = useState('date,course,tee,player,hole1,hole2,hole3,hole4,hole5,hole6,hole7,hole8,hole9,hole10,hole11,hole12,hole13,hole14,hole15,hole16,hole17,hole18\n');
  const [importResult, setImportResult] = useState<RoundImportSyncResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<'idle' | 'in_progress' | 'queued' | 'complete'>('idle');
  const [importProgress, setImportProgress] = useState(0);
  const [importProgressText, setImportProgressText] = useState('');
  const [importQueueInfo, setImportQueueInfo] = useState<RoundImportQueuedResponse | null>(null);
  const importProgressRef = useRef<number | null>(null);

  const fetchRounds = async (targetPage = page) => {
    try {
      const response = await roundsApi.list({
        page: targetPage,
        limit: PAGE_SIZE,
        courseId: selectedCourseId || undefined,
        teeConfigurationId: selectedTeeConfigurationId || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });

      setRounds(response.data.rounds);
      setPagination(response.data.pagination);
      setError(null);
    } catch (err) {
      setRounds([]);
      setError(handleApiError(err));
    }
  };

  useEffect(
    () => () => {
      if (importProgressRef.current !== null) {
        window.clearInterval(importProgressRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    const fetchCourses = async () => {
      try {
        const response = await coursesApi.list(1, 100);
        if (cancelled) return;
        setCourses(response.data.data);
      } catch (err) {
        if (cancelled) return;
        setCourses([]);
        setError(handleApiError(err));
      }
    };

    void fetchCourses();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      return;
    }

    let cancelled = false;

    const fetchCourse = async () => {
      try {
        const response = await coursesApi.get(selectedCourseId);
        if (cancelled) return;
        setTeeConfigurations(response.data.tee_configurations ?? []);
      } catch (err) {
        if (cancelled) return;
        setTeeConfigurations([]);
        setError(handleApiError(err));
      }
    };

    void fetchCourse();

    return () => {
      cancelled = true;
    };
  }, [selectedCourseId]);

  useEffect(() => {
    let cancelled = false;

    const loadRounds = async () => {
      try {
        const response = await roundsApi.list({
          page,
          limit: PAGE_SIZE,
          courseId: selectedCourseId || undefined,
          teeConfigurationId: selectedTeeConfigurationId || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        });

        if (cancelled) return;
        setRounds(response.data.rounds);
        setPagination(response.data.pagination);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setRounds([]);
        setError(handleApiError(err));
      }
    };

    void loadRounds();

    return () => {
      cancelled = true;
    };
  }, [page, selectedCourseId, selectedTeeConfigurationId, fromDate, toDate]);

  const visibleRounds = useMemo(() => {
    const items = rounds ?? [];
    if (selectedStatus === 'all') return items;
    return items.filter((round) => (round.status ?? 'pending') === selectedStatus);
  }, [rounds, selectedStatus]);

  const courseOptions = useMemo(
    () => [{ value: '', label: 'All courses' }, ...courses.map((course) => ({ value: course.id, label: course.name }))],
    [courses],
  );

  const teeOptions = useMemo(
    () => [
      { value: '', label: selectedCourseId ? 'All tee configurations' : 'Select a course first' },
      ...teeConfigurations.map((teeConfiguration) => ({
        value: teeConfiguration.id,
        label: `${teeConfiguration.name} (${teeConfiguration.tee_colour})`,
      })),
    ],
    [selectedCourseId, teeConfigurations],
  );

  const updateRoundStatus = (roundId: string, status: string, rejectionReasonValue: string | null) => {
    setRounds((current) =>
      current?.map((round) =>
        round.id === roundId
          ? { ...round, status, rejectionReason: rejectionReasonValue }
          : round,
      ) ?? current,
    );
  };

  const handleApprove = async (roundId: string) => {
    setPendingActionId(roundId);
    try {
      await roundsApi.approve(roundId);
      updateRoundStatus(roundId, 'approved', null);
      showSuccessToast('Round approved', 'The round is now marked as approved.');
    } catch (err) {
      showErrorToast('Approve failed', handleApiError(err));
    } finally {
      setPendingActionId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingRound || !rejectionReason.trim()) {
      return;
    }

    setPendingActionId(rejectingRound.id);
    try {
      await roundsApi.reject(rejectingRound.id, rejectionReason.trim());
      updateRoundStatus(rejectingRound.id, 'rejected', rejectionReason.trim());
      showSuccessToast('Round rejected', 'The rejection reason was saved.');
      setRejectingRound(null);
      setRejectionReason('');
    } catch (err) {
      showErrorToast('Reject failed', handleApiError(err));
    } finally {
      setPendingActionId(null);
    }
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    setRounds(null);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      setImportCsvText(text);
    } catch (error) {
      showErrorToast('Unable to read CSV', error instanceof Error ? error.message : 'Failed to read selected file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportRounds = async (dryRun: boolean) => {
    const csvText = importCsvText.trim();
    if (!csvText) {
      showErrorToast('Missing CSV', 'Paste CSV content or choose a CSV file first.');
      return;
    }

    const nonEmptyLines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const rowCount = Math.max(0, nonEmptyLines.length - 1);

    setIsImporting(true);
    setImportResult(null);
    setImportQueueInfo(null);
    setImportPhase('idle');
    setImportProgress(0);
    setImportProgressText('');

    if (!dryRun && rowCount > 0 && rowCount <= SMALL_IMPORT_THRESHOLD) {
      const animationDurationMs = Math.max(500, Math.min(3000, rowCount * 20));
      const startedAt = Date.now();
      setImportPhase('in_progress');
      setImportProgress(1);
      setImportProgressText(`Importing row 1 of ${rowCount}...`);

      if (importProgressRef.current !== null) {
        window.clearInterval(importProgressRef.current);
      }

      importProgressRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const ratio = Math.min(1, elapsed / animationDurationMs);
        const targetPercent = Math.min(88, Math.max(1, Math.round(ratio * 88)));
        const currentRow = Math.max(1, Math.min(rowCount, Math.round((targetPercent / 88) * rowCount)));

        setImportProgress(targetPercent);
        setImportProgressText(`Importing row ${currentRow} of ${rowCount}...`);

        if (ratio >= 1 && importProgressRef.current !== null) {
          window.clearInterval(importProgressRef.current);
          importProgressRef.current = null;
          setImportProgress(88);
          setImportProgressText('Finalizing import...');
        }
      }, 50);
    }

    try {
      const result = await roundsApi.importCsv(csvText, dryRun);

      if (importProgressRef.current !== null) {
        window.clearInterval(importProgressRef.current);
        importProgressRef.current = null;
      }

      if ('queued' in result && result.queued) {
        setImportPhase('queued');
        setImportQueueInfo(result);
        setImportProgress(0);
        setImportProgressText('');
        showSuccessToast('Import queued', result.message);
        return;
      }

      const syncResult = result as RoundImportSyncResponse;
      setImportResult(syncResult);
      setImportPhase('complete');

      if (dryRun) {
        showSuccessToast('Validation complete', `${syncResult.summary.validRows ?? 0} valid rows, ${syncResult.summary.invalidRows ?? 0} invalid rows.`);
      } else {
        setImportProgress(100);
        setImportProgressText(`Import complete: ${syncResult.summary.importedRows ?? 0} of ${syncResult.summary.rowCount} rows imported.`);
        showSuccessToast('Rounds imported', `Imported ${syncResult.summary.importedRows ?? 0} round records.`);
        setPage(1);
        setRounds(null);
        await fetchRounds(1);
      }
    } catch (error) {
      if (importProgressRef.current !== null) {
        window.clearInterval(importProgressRef.current);
        importProgressRef.current = null;
      }
      setImportPhase('idle');
      setImportProgress(0);
      setImportProgressText('');
      setImportResult(null);
      showErrorToast('Import failed', error instanceof Error ? error.message : 'Unable to import rounds CSV.');
    } finally {
      setIsImporting(false);
    }
  };

  const loading = rounds === null && !error;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Admin</p>
        <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={ClipboardList} size="lg" className="text-teal-600 dark:text-teal-400" />
          Round management
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Review round submissions, open scorecards, and moderate approvals from one queue.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import rounds from CSV</h3>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Supports date, course, tee, player, and hole-score columns. Use dry run first to review validation issues before importing.
          </p>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="round-import-csv">
              Round CSV
            </label>
            <textarea
              id="round-import-csv"
              className="min-h-48 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              value={importCsvText}
              onChange={(event) => setImportCsvText(event.target.value)}
              spellCheck={false}
            />
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept=".csv,text/csv" aria-label="Upload rounds CSV" onChange={(event) => void handleImportFile(event)} />
              <Button variant="secondary" onClick={() => void handleImportRounds(true)} disabled={isImporting}>
                {isImporting ? 'Running...' : 'Dry run validation'}
              </Button>
              <Button onClick={() => void handleImportRounds(false)} disabled={isImporting}>
                {isImporting ? 'Running...' : 'Import rounds'}
              </Button>
            </div>
          </div>

          {importPhase === 'in_progress' && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm dark:border-teal-900/60 dark:bg-teal-950/20">
              <p className="font-medium text-teal-800 dark:text-teal-200">Import in progress</p>
              <p className="mt-1 text-teal-700 dark:text-teal-300">{importProgressText}</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-teal-100 dark:bg-teal-900/40">
                <div
                  className="h-full rounded-full bg-teal-600 transition-all duration-200 dark:bg-teal-400"
                  style={{ width: `${importProgress}%` }}
                  aria-label="Import progress"
                />
              </div>
              <p className="mt-2 text-xs text-teal-700 dark:text-teal-300">{importProgress}% complete</p>
            </div>
          )}

          {importPhase === 'queued' && importQueueInfo && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/20">
              <p className="font-medium text-amber-800 dark:text-amber-200">Large import queued</p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">{importQueueInfo.message}</p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                Job ID: <span className="font-mono">{importQueueInfo.jobId}</span>
              </p>
            </div>
          )}

          {importResult && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/50">
              <p className="font-medium text-slate-900 dark:text-slate-100">
                {importResult.dryRun ? 'Dry run summary' : 'Import summary'}: {importResult.summary.rowCount} rows processed
              </p>
              {'validRows' in importResult.summary && (
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  {importResult.summary.validRows ?? 0} valid, {importResult.summary.invalidRows ?? 0} invalid, {importResult.summary.totalIssues ?? 0} issues found.
                </p>
              )}
              {'importedRows' in importResult.summary && (
                <p className="mt-1 text-slate-600 dark:text-slate-300">Imported {importResult.summary.importedRows ?? 0} rounds.</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Round filters</h3>
        </CardHeader>
        <CardBody>
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Admin round filters form">
            <Select
              label="Course"
              name="courseId"
              options={courseOptions}
              value={selectedCourseId}
              onChange={(event) => {
                setSelectedCourseId(event.target.value);
                setSelectedTeeConfigurationId('');
                setPage(1);
                setRounds(null);
              }}
            />
            <Select
              label="Tee"
              name="teeConfigurationId"
              options={teeOptions}
              value={selectedTeeConfigurationId}
              disabled={!selectedCourseId}
              onChange={(event) => {
                setSelectedTeeConfigurationId(event.target.value);
                setPage(1);
                setRounds(null);
              }}
            />
            <Select
              label="Status"
              name="status"
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value)}
            />
            <Input
              label="From"
              name="fromDate"
              type="date"
              value={fromDate}
              onChange={(event) => {
                setFromDate(event.target.value);
                setPage(1);
                setRounds(null);
              }}
            />
            <Input
              label="To"
              name="toDate"
              type="date"
              value={toDate}
              onChange={(event) => {
                setToDate(event.target.value);
                setPage(1);
                setRounds(null);
              }}
            />
          </form>
        </CardBody>
      </Card>

      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading ? (
        <SkeletonTable rows={8} columns={7} />
      ) : (
        <div className="space-y-4">
          <div className="md:hidden space-y-3" aria-label="Admin rounds mobile list">
            {visibleRounds.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                No rounds match the current filters.
              </div>
            ) : (
              visibleRounds.map((round) => (
                <article
                  key={round.id}
                  role="button"
                  tabIndex={0}
                  className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                  onClick={() => navigate(`/rounds/${round.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/rounds/${round.id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatPlayer(round.playerFirstName, round.playerLastName)}</p>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{round.courseName} · {formatDate(round.playedAt)}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(round.status ?? 'pending')}`}>
                      {round.status ?? 'pending'}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
                    <Button size="sm" onClick={() => void handleApprove(round.id)} disabled={pendingActionId === round.id || (round.status ?? 'pending') === 'approved'} title="Approve round" aria-label="Approve round">
                      <Icon icon={CheckCircle} size="sm" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRejectingRound(round);
                        setRejectionReason(round.rejectionReason ?? '');
                      }}
                      disabled={pendingActionId === round.id}
                      title="Reject round"
                      aria-label="Reject round"
                    >
                      <Icon icon={XCircle} size="sm" />
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="hidden md:block" aria-label="Admin rounds table">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Player</TableHeaderCell>
                  <TableHeaderCell>Course</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Score</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Reason</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRounds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      No rounds match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRounds.map((round) => (
                    <TableRow
                      key={round.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/rounds/${round.id}`)}
                    >
                      <TableCell>{formatPlayer(round.playerFirstName, round.playerLastName)}</TableCell>
                      <TableCell>{round.courseName}</TableCell>
                      <TableCell>{formatDate(round.playedAt)}</TableCell>
                      <TableCell>{round.grossScore}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusTone(round.status ?? 'pending')}`}>
                          {round.status ?? 'pending'}
                        </span>
                      </TableCell>
                      <TableCell>{round.rejectionReason ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                          <Button size="sm" onClick={() => void handleApprove(round.id)} disabled={pendingActionId === round.id || (round.status ?? 'pending') === 'approved'} title="Approve round" aria-label="Approve round">
                            <Icon icon={CheckCircle} size="sm" />
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setRejectingRound(round);
                              setRejectionReason(round.rejectionReason ?? '');
                            }}
                            disabled={pendingActionId === round.id}
                            title="Reject round"
                            aria-label="Reject round"
                          >
                            <Icon icon={XCircle} size="sm" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {pagination.totalPages > 1 ? (
            <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={handlePageChange} />
          ) : null}
        </div>
      )}

      <Modal
        isOpen={rejectingRound !== null}
        onClose={() => {
          if (pendingActionId) return;
          setRejectingRound(null);
          setRejectionReason('');
        }}
        title="Reject round"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Provide a rejection reason for{' '}
            <strong>{rejectingRound ? formatPlayer(rejectingRound.playerFirstName, rejectingRound.playerLastName) : ''}</strong>.
          </p>
          <Input
            label="Rejection reason"
            name="rejectionReason"
            aria-label="Rejection reason"
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Explain why the round is being rejected"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRejectingRound(null);
                setRejectionReason('');
              }}
              disabled={Boolean(pendingActionId)}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleReject()} disabled={Boolean(pendingActionId) || !rejectionReason.trim()}>
              Confirm rejection
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminRoundsPage;