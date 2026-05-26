import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { handleApiError } from '../api/client';
import { coursesApi, type Course, type TeeConfiguration } from '../api/courses';
import { roundsApi, type RoundListItem } from '../api/rounds';
import { Card, CardBody, CardHeader, Input, Pagination, Select, SkeletonTable, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui';

const PAGE_SIZE = 10;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
}

export const RoundsPage: React.FC = () => {
  const [rounds, setRounds] = useState<RoundListItem[] | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teeConfigurations, setTeeConfigurations] = useState<TeeConfiguration[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTeeConfigurationId, setSelectedTeeConfigurationId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setTeeConfigurations([]);
      setSelectedTeeConfigurationId('');
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
      setIsFetching(true);
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
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    void fetchRounds();

    return () => {
      cancelled = true;
    };
  }, [page, selectedCourseId, selectedTeeConfigurationId, fromDate, toDate]);

  const loading = rounds === null && !error;

  const courseOptions = useMemo(
    () => [
      { value: '', label: 'All courses' },
      ...courses.map((course) => ({ value: course.id, label: course.name })),
    ],
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

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    setRounds(null);
  };

  const handleCourseChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCourseId(event.target.value);
    setSelectedTeeConfigurationId('');
    setPage(1);
    setRounds(null);
  };

  const handleTeeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeeConfigurationId(event.target.value);
    setPage(1);
    setRounds(null);
  };

  const handleDateChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setter(event.target.value);
      setPage(1);
      setRounds(null);
    };

  const roundRows = rounds || [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Rounds</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Browse historical rounds, filter by date range, and open scorecards from the list.
          </p>
        </div>
        <Link
          to="/rounds/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:bg-teal-500 dark:hover:bg-teal-400"
        >
          + Enter round
        </Link>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Round filters</h3>
        </CardHeader>
        <CardBody>
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Round filters form">
            <Input
              label="From"
              name="fromDate"
              type="date"
              placeholder="From date"
              value={fromDate}
              onChange={handleDateChange(setFromDate)}
            />
            <Input
              label="To"
              name="toDate"
              type="date"
              placeholder="To date"
              value={toDate}
              onChange={handleDateChange(setToDate)}
            />
            <Select
              label="Course"
              name="courseId"
              placeholder="All courses"
              value={selectedCourseId}
              onChange={handleCourseChange}
              options={courseOptions}
            />
            <Select
              label="Tee configuration"
              name="teeConfigurationId"
              placeholder={selectedCourseId ? 'All tee configurations' : 'Select a course first'}
              value={selectedTeeConfigurationId}
              onChange={handleTeeChange}
              options={teeOptions}
              disabled={!selectedCourseId}
            />
          </form>
        </CardBody>
      </Card>

      {isFetching && rounds !== null && (
        <p className="text-xs text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
          Updating round results...
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {(roundRows || []).length > 0 ? (
        <div className="space-y-4">
          <div className="space-y-3 md:hidden" aria-label="Mobile round list">
            {roundRows.map((round) => (
              <article
                key={round.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      to={`/rounds/${round.id}`}
                      className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200"
                    >
                      {round.id}
                    </Link>
                    <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">
                      {formatDate(round.playedAt)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {round.courseName} • {round.teeConfigurationName} tee
                    </p>
                  </div>
                  <span
                    className={[
                      'rounded-full px-2.5 py-1 text-xs font-semibold',
                      round.flags.is9Hole
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
                    ].join(' ')}
                  >
                    {round.flags.is9Hole ? '9-hole' : '18-hole'}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Gross</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">{round.grossScore}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Adjusted</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">{round.adjustedGrossScore}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Putts</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">{round.totals.putts}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Penalties</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">{round.totals.penalties}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden md:block" aria-label="Desktop round table">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Round</TableHeaderCell>
                  <TableHeaderCell>Played</TableHeaderCell>
                  <TableHeaderCell>Course</TableHeaderCell>
                  <TableHeaderCell>Tee</TableHeaderCell>
                  <TableHeaderCell>Gross</TableHeaderCell>
                  <TableHeaderCell>Adjusted</TableHeaderCell>
                  <TableHeaderCell>Putts</TableHeaderCell>
                  <TableHeaderCell>Penalties</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roundRows.map((round) => (
                  <TableRow key={round.id}>
                    <TableCell>
                      <Link to={`/rounds/${round.id}`} className="font-semibold text-teal-700 hover:text-teal-800 dark:text-teal-300 dark:hover:text-teal-200">
                        {round.id}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(round.playedAt)}</TableCell>
                    <TableCell>{round.courseName}</TableCell>
                    <TableCell>{round.teeConfigurationName}</TableCell>
                    <TableCell>{round.grossScore}</TableCell>
                    <TableCell>{round.adjustedGrossScore}</TableCell>
                    <TableCell>{round.totals.putts}</TableCell>
                    <TableCell>{round.totals.penalties}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-center">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              loading={loading}
            />
          </div>
        </div>
      ) : loading ? (
        <SkeletonTable rows={5} columns={8} />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-sm text-slate-600 dark:text-slate-400">No rounds found</p>
        </div>
      )}
    </div>
  );
};

export default RoundsPage;
