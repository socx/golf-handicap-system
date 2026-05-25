import { useEffect, useState } from 'react';
import { type TeeConfiguration, coursesApi } from '../../api/courses';

export interface TeeConfigurationSelectorProps {
  /** The course id to load tee configurations for */
  courseId: string | null | undefined;
  /** Currently selected tee configuration */
  value?: TeeConfiguration | null;
  /** Called when the user changes their selection */
  onChange: (config: TeeConfiguration | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function TeeConfigurationSelector({
  courseId,
  value,
  onChange,
  label,
  placeholder = 'Select tee configuration…',
  disabled = false,
  className = '',
  id,
}: TeeConfigurationSelectorProps) {
  const [configs, setConfigs] = useState<TeeConfiguration[]>([]);
  const [fetchedCourseId, setFetchedCourseId] = useState<string | null | undefined>(undefined);

  // Derive loading: courseId is set but we haven't fetched for it yet
  const loading = !!courseId && courseId !== fetchedCourseId;

  useEffect(() => {
    if (!courseId || courseId === fetchedCourseId) return;
    let cancelled = false;
    coursesApi
      .get(courseId)
      .then((res) => {
        if (!cancelled) {
          setConfigs(res.data.tee_configurations ?? []);
          setFetchedCourseId(courseId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfigs([]);
          setFetchedCourseId(courseId);
        }
      })
    return () => {
      cancelled = true;
    };
  }, [courseId, fetchedCourseId]);

  // Only show configs for the currently selected course
  const visibleConfigs = courseId && courseId === fetchedCourseId ? configs : [];

  // If the current value belongs to a different course, treat as unselected.
  // Parent is responsible for clearing value when courseId changes.
  const effectiveValue = value && value.course_id === courseId ? value : null;

  const selectId = id ?? 'tee-configuration-selector';

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={effectiveValue?.id ?? ''}
        disabled={disabled || !courseId || loading}
        onChange={(e) => {
          const found = visibleConfigs.find((c) => c.id === e.target.value) ?? null;
          onChange(found);
        }}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-50"
      >
        <option value="">
          {loading ? 'Loading…' : !courseId ? 'Select a course first' : placeholder}
        </option>
        {visibleConfigs.map((config) => (
          <option key={config.id} value={config.id}>
            {config.name} ({config.tee_colour}) — {config.hole_count} holes · CR {config.course_rating} / Slope{' '}
            {config.slope_rating}
          </option>
        ))}
      </select>
    </div>
  );
}

