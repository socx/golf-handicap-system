import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { coursesApi, type Course } from '../api/courses';
import { Button } from '../components/ui/Button';
import { SkeletonCard, SkeletonForm, SkeletonList, SkeletonTable } from '../components/ui/Skeleton';

export const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;

    let cancelled = false;

    const fetchCourse = async () => {
      try {
        const response = await coursesApi.get(courseId);
        if (cancelled) return;
        setCourse(response.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch course:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch course');
      }
    };

    void fetchCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const loading = !!courseId && !course && !error;

  if (!courseId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Course Details</h2>
          <Button variant="secondary" onClick={() => navigate('/courses')}>
            Back to Courses
          </Button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-300">Course ID is missing</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <SkeletonCard className="max-w-xl" />
          </div>
          <div className="hidden md:block">
            <SkeletonForm fields={0} className="w-36 p-0" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonForm fields={4} />
          <SkeletonList items={3} />
        </div>

        <div className="space-y-4">
          <SkeletonTable rows={3} columns={4} />
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Course Details</h2>
          <Button variant="secondary" onClick={() => navigate('/courses')}>
            Back to Courses
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {!error && !course && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm text-slate-600 dark:text-slate-400">Course not found</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{course.name}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {course.city}, {course.country}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(`/courses/${course.id}/edit`)}>
            Edit Course
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/courses/${course.id}/configurations/new`)}>
            Add Tee Configuration
          </Button>
          <Button variant="secondary" onClick={() => navigate('/courses')}>
            Back to Courses
          </Button>
        </div>
      </div>

      {/* Course Details Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/40">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Course Information</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {course.address && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                Address
              </p>
              <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{course.address}</p>
            </div>
          )}

          {course.email && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                Email
              </p>
              <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                <a href={`mailto:${course.email}`} className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
                  {course.email}
                </a>
              </p>
            </div>
          )}

          {course.phone && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                Phone
              </p>
              <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                <a href={`tel:${course.phone}`} className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300">
                  {course.phone}
                </a>
              </p>
            </div>
          )}

          {course.website && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                Website
              </p>
              <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                <a
                  href={course.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                >
                  {course.website}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tee Configurations Section */}
      {course.tee_configurations && course.tee_configurations.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Tee Configurations</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {course.tee_configurations.map((teeConfig) => (
              <div
                key={teeConfig.id}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                      Tee Name
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{teeConfig.name}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                        Colour
                      </p>
                      <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{teeConfig.tee_colour}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                        Holes
                      </p>
                      <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{teeConfig.hole_count}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                          Rating
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {teeConfig.course_rating}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                          Slope
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {teeConfig.slope_rating}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hole Details Grid */}
                  {teeConfig.holes && teeConfig.holes.length > 0 && (
                    <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400 mb-2">
                        Holes
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                              <th className="text-left px-1 py-1 font-semibold text-slate-600 dark:text-slate-400">
                                #
                              </th>
                              <th className="text-left px-1 py-1 font-semibold text-slate-600 dark:text-slate-400">
                                Par
                              </th>
                              <th className="text-left px-1 py-1 font-semibold text-slate-600 dark:text-slate-400">
                                Yards
                              </th>
                              <th className="text-left px-1 py-1 font-semibold text-slate-600 dark:text-slate-400">
                                SI
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {teeConfig.holes.slice(0, 9).map((hole) => (
                              <tr key={hole.id} className="border-b border-slate-100 transition hover:bg-teal-50 dark:border-slate-800 dark:hover:bg-slate-800">
                                <td className="text-left px-1 py-1 text-slate-900 dark:text-slate-100">
                                  {hole.hole_number}
                                </td>
                                <td className="text-left px-1 py-1 text-slate-900 dark:text-slate-100">
                                  {hole.par}
                                </td>
                                <td className="text-left px-1 py-1 text-slate-900 dark:text-slate-100">
                                  {hole.distance_yards}
                                </td>
                                <td className="text-left px-1 py-1 text-slate-900 dark:text-slate-100">
                                  {hole.stroke_index}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {teeConfig.holes.length > 9 && (
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                          Showing first 9 holes ({teeConfig.holes.length} total)
                        </p>
                      )}
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/courses/${course.id}/configurations/${teeConfig.id}/edit`)}
                      >
                        Edit Configuration
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/courses/${course.id}/configurations/new?cloneFrom=${teeConfig.id}`)}
                      >
                        Duplicate
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-sm text-slate-600 dark:text-slate-400">No tee configurations available for this course</p>
        </div>
      )}
    </div>
  );
};

export default CourseDetailPage;
