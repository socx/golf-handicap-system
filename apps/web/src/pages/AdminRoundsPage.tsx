import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleApiError } from '../api/client';
import { coursesApi, type Course, type TeeConfiguration } from '../api/courses';
import { roundsApi, type RoundListItem } from '../api/rounds';
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
import { showErrorToast, showSuccessToast } from '../lib/toast';

const PAGE_SIZE = 10;

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

    const fetchRounds = async () => {
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

    void fetchRounds();

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

  const loading = rounds === null && !error;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">Admin</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Round management</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Review round submissions, open scorecards, and moderate approvals from one queue.
        </p>
      </div>

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
                    <Button size="sm" onClick={() => void handleApprove(round.id)} disabled={pendingActionId === round.id || (round.status ?? 'pending') === 'approved'}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRejectingRound(round);
                        setRejectionReason(round.rejectionReason ?? '');
                      }}
                      disabled={pendingActionId === round.id}
                    >
                      Reject
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
                          <Button size="sm" onClick={() => void handleApprove(round.id)} disabled={pendingActionId === round.id || (round.status ?? 'pending') === 'approved'}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setRejectingRound(round);
                              setRejectionReason(round.rejectionReason ?? '');
                            }}
                            disabled={pendingActionId === round.id}
                          >
                            Reject
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