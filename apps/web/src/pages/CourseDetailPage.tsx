import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { coursesApi, type Course } from '../api/courses';
import { Button } from '../components/ui/Button';

export const CourseDetailPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setError('Course ID is missing');
      return;
    }

    const fetchCourse = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await coursesApi.get(courseId);
        setCourse(response.data);
      } catch (err) {
        console.error('Failed to fetch course:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch course');
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [courseId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Course Details</h2>
          <Button variant="secondary" onClick={() => navigate('/courses')}>
            Back to Courses
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!error && !course && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-sm text-slate-600">Course not found</p>
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
          <h2 className="text-2xl font-semibold text-slate-900">{course.name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {course.city}, {course.country}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/courses')}>
          Back to Courses
        </Button>
      </div>

      {/* Course Details Card */}
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-slate-900">Course Information</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {course.address && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Address
              </p>
              <p className="mt-1 text-sm text-slate-900">{course.address}</p>
            </div>
          )}

          {course.email && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Email
              </p>
              <p className="mt-1 text-sm text-slate-900">
                <a href={`mailto:${course.email}`} className="text-teal-600 hover:text-teal-700">
                  {course.email}
                </a>
              </p>
            </div>
          )}

          {course.phone && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Phone
              </p>
              <p className="mt-1 text-sm text-slate-900">
                <a href={`tel:${course.phone}`} className="text-teal-600 hover:text-teal-700">
                  {course.phone}
                </a>
              </p>
            </div>
          )}

          {course.website && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                Website
              </p>
              <p className="mt-1 text-sm text-slate-900">
                <a
                  href={course.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-600 hover:text-teal-700"
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
          <h3 className="text-lg font-semibold text-slate-900">Tee Configurations</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {course.tee_configurations.map((teeConfig) => (
              <div
                key={teeConfig.id}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:shadow-md transition"
              >
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                      Tee Name
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">{teeConfig.name}</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Colour
                      </p>
                      <p className="mt-1 text-sm text-slate-900">{teeConfig.tee_colour}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Holes
                      </p>
                      <p className="mt-1 text-sm text-slate-900">{teeConfig.hole_count}</p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          Rating
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {teeConfig.course_rating.toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
                          Slope
                        </p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {teeConfig.slope_rating}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hole Details Grid */}
                  {teeConfig.holes && teeConfig.holes.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 mb-2">
                        Holes
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left px-1 py-1 font-semibold text-slate-600">
                                #
                              </th>
                              <th className="text-left px-1 py-1 font-semibold text-slate-600">
                                Par
                              </th>
                              <th className="text-left px-1 py-1 font-semibold text-slate-600">
                                Yards
                              </th>
                              <th className="text-left px-1 py-1 font-semibold text-slate-600">
                                SI
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {teeConfig.holes.slice(0, 9).map((hole) => (
                              <tr key={hole.id} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="text-left px-1 py-1 text-slate-900">
                                  {hole.hole_number}
                                </td>
                                <td className="text-left px-1 py-1 text-slate-900">
                                  {hole.par}
                                </td>
                                <td className="text-left px-1 py-1 text-slate-900">
                                  {hole.distance_yards}
                                </td>
                                <td className="text-left px-1 py-1 text-slate-900">
                                  {hole.stroke_index}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {teeConfig.holes.length > 9 && (
                        <p className="mt-2 text-xs text-slate-600">
                          Showing first 9 holes ({teeConfig.holes.length} total)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-600">No tee configurations available for this course</p>
        </div>
      )}
    </div>
  );
};

export default CourseDetailPage;
