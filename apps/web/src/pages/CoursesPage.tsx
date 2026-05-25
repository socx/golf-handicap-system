import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { coursesApi, type Course } from '../api/courses';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Table, TableHead, TableBody } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/Skeleton';

export const CoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchCourses = async () => {
      setIsFetching(true);
      try {
        const response = await coursesApi.list(page, 10, search || undefined, country || undefined);
        if (cancelled) return;
        setCourses(response.data.data);
        setPagination(response.data.pagination);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch courses:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch courses');
        setCourses([]);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    };

    void fetchCourses();

    return () => {
      cancelled = true;
    };
  }, [page, search, country]);

  const loading = courses === null && !error;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
    setCourses(null);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCountry(e.target.value);
    setPage(1);
    setCourses(null);
  };

  const handleCourseClick = (courseId: string) => {
    navigate(`/courses/${courseId}`);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    setCourses(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Courses</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Browse and manage golf courses.</p>
      </div>

      {/* Search and filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          placeholder="Search courses by name..."
          value={search}
          onChange={handleSearchChange}
        />
        <Input
          placeholder="Filter by country..."
          value={country}
          onChange={handleCountryChange}
        />
      </div>

      {/* Fetching status */}
      {isFetching && courses !== null && (
        <p role="status" aria-live="polite" className="sr-only">Updating course results...</p>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Courses table */}
      {(courses || []).length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:border-slate-800 dark:text-slate-300">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </TableHead>
            <TableBody>
              {(courses || []).map((course) => (
                <tr
                  key={course.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900/40"
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{course.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{course.city}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{course.country}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{course.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCourseClick(course.id)}
                      disabled={loading}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex justify-center">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={handlePageChange}
              loading={loading}
            />
          </div>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          <SkeletonTable rows={5} columns={5} />
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-sm text-slate-600 dark:text-slate-400">No courses found</p>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;
