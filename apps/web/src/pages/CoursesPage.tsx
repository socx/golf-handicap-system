import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { coursesApi, type Course } from '../api/courses';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';

export const CoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
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
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Courses</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Browse and manage golf courses.</p>
        </div>
        {isAdmin ? (
          <Button variant="primary" onClick={() => navigate('/courses/new')}>
            Create Course
          </Button>
        ) : null}
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
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>City</TableHeaderCell>
                <TableHeaderCell>Country</TableHeaderCell>
                <TableHeaderCell>Phone</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(courses || []).map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium">{course.name}</TableCell>
                  <TableCell>{course.city}</TableCell>
                  <TableCell>{course.country}</TableCell>
                  <TableCell>{course.phone || '—'}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCourseClick(course.id)}
                      disabled={loading}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
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
