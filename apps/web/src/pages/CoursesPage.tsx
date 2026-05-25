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
        <h2 className="text-2xl font-semibold text-slate-900">Courses</h2>
        <p className="mt-1 text-sm text-slate-600">Browse and manage golf courses.</p>
      </div>

      {/* Search and filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          placeholder="Search courses by name..."
          value={search}
          onChange={handleSearchChange}
          disabled={loading}
        />
        <Input
          placeholder="Filter by country..."
          value={country}
          onChange={handleCountryChange}
          disabled={loading}
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Courses table */}
      {(courses || []).length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
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
                  className="border-b border-slate-100 transition hover:bg-slate-50"
                >
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{course.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{course.city}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{course.country}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{course.phone || '—'}</td>
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">No courses found</p>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;
