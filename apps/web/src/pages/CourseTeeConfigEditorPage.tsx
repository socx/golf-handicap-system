import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { handleApiError } from '../api/client';
import {
  coursesApi,
  type TeeConfigurationUpdatePayload,
} from '../api/courses';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SkeletonForm } from '../components/ui/Skeleton';
import { showErrorToast, showSuccessToast } from '../lib/toast';

interface HoleFormRow {
  id?: string;
  holeNumber: number;
  distanceYards: number | null;
  par: number;
  strokeIndex: number;
}

interface MetadataForm {
  name: string;
  teeColour: string;
  courseRating: number | null;
  slopeRating: number | null;
  holeCount: 9 | 18;
}

interface ValidationIssue {
  field: string;
  message: string;
}

function buildDefaultHoles(holeCount: 9 | 18): HoleFormRow[] {
  return Array.from({ length: holeCount }, (_, index) => ({
    holeNumber: index + 1,
    distanceYards: null,
    par: 4,
    strokeIndex: index + 1,
  }));
}

function parseNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function validateForm(metadata: MetadataForm, holes: HoleFormRow[], isEditMode: boolean): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!metadata.name.trim()) {
    issues.push({ field: 'name', message: 'Configuration name is required.' });
  }

  if (!metadata.teeColour.trim()) {
    issues.push({ field: 'teeColour', message: 'Tee colour is required.' });
  }

  if (metadata.courseRating !== null && (Number.isNaN(metadata.courseRating) || metadata.courseRating < 0)) {
    issues.push({ field: 'courseRating', message: 'Course rating must be a non-negative number.' });
  }

  if (metadata.slopeRating !== null && (!Number.isInteger(metadata.slopeRating) || metadata.slopeRating < 1)) {
    issues.push({ field: 'slopeRating', message: 'Slope rating must be a positive integer.' });
  }

  if (!isEditMode && holes.length !== metadata.holeCount) {
    issues.push({ field: 'holes', message: `Hole count must be exactly ${metadata.holeCount}.` });
  }

  if (holes.length === 0) {
    issues.push({ field: 'holes', message: 'At least one hole row is required.' });
  }

  const holeNumbers = holes.map((h) => h.holeNumber);
  if (new Set(holeNumbers).size !== holeNumbers.length) {
    issues.push({ field: 'holes', message: 'Hole numbers must be unique.' });
  }

  for (let index = 0; index < holes.length; index += 1) {
    const hole = holes[index];
    if (!Number.isInteger(hole.holeNumber) || hole.holeNumber < 1 || hole.holeNumber > 18) {
      issues.push({ field: `hole-${index}-number`, message: `Hole ${index + 1}: hole number must be 1-18.` });
    }
    if (hole.distanceYards !== null && (!Number.isInteger(hole.distanceYards) || hole.distanceYards < 0)) {
      issues.push({ field: `hole-${index}-distance`, message: `Hole ${index + 1}: distance must be a non-negative integer.` });
    }
    if (!Number.isInteger(hole.par) || hole.par < 3 || hole.par > 5) {
      issues.push({ field: `hole-${index}-par`, message: `Hole ${index + 1}: par must be 3, 4, or 5.` });
    }
    if (!Number.isInteger(hole.strokeIndex) || hole.strokeIndex < 1 || hole.strokeIndex > 18) {
      issues.push({ field: `hole-${index}-si`, message: `Hole ${index + 1}: stroke index must be 1-18.` });
    }
  }

  return issues;
}

export const CourseTeeConfigEditorPage: React.FC = () => {
  const { courseId, configId } = useParams<{ courseId: string; configId?: string }>();
  const navigate = useNavigate();

  const isEditMode = !!configId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  const [metadata, setMetadata] = useState<MetadataForm>({
    name: '',
    teeColour: '',
    courseRating: null,
    slopeRating: null,
    holeCount: 9,
  });
  const [holes, setHoles] = useState<HoleFormRow[]>(buildDefaultHoles(9));

  useEffect(() => {
    if (!courseId) return;

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const response = await coursesApi.get(courseId);
        if (cancelled) return;

        if (isEditMode) {
          const config = (response.data.tee_configurations || []).find((c) => c.id === configId);
          if (!config) {
            setPageError('Tee configuration not found.');
            setLoading(false);
            return;
          }

          setMetadata({
            name: config.name,
            teeColour: config.tee_colour,
            courseRating: config.course_rating ?? null,
            slopeRating: config.slope_rating ?? null,
            holeCount: (config.hole_count === 18 ? 18 : 9),
          });
          setHoles(
            (config.holes || [])
              .slice()
              .sort((a, b) => a.hole_number - b.hole_number)
              .map((hole) => ({
                id: hole.id,
                holeNumber: hole.hole_number,
                distanceYards: hole.distance_yards,
                par: hole.par,
                strokeIndex: hole.stroke_index,
              })),
          );
        }

        setPageError(null);
      } catch (error) {
        if (cancelled) return;
        setPageError(handleApiError(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [courseId, configId, isEditMode]);

  const title = useMemo(
    () => (isEditMode ? 'Edit Tee Configuration' : 'Create Tee Configuration'),
    [isEditMode],
  );

  const handleMetadataChange =
    (field: keyof MetadataForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      setMetadata((prev) => {
        if (field === 'courseRating' || field === 'slopeRating') {
          return {
            ...prev,
            [field]: parseNumberOrNull(raw),
          } as MetadataForm;
        }

        return {
          ...prev,
          [field]: raw,
        } as MetadataForm;
      });

      setValidationIssues((prev) => prev.filter((issue) => issue.field !== field));
    };

  const handleHoleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value) === 18 ? 18 : 9;
    setMetadata((prev) => ({ ...prev, holeCount: value }));
    if (!isEditMode) {
      setHoles(buildDefaultHoles(value));
    }
  };

  const handleHoleChange =
    (index: number, field: keyof HoleFormRow) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setHoles((prev) => {
        const next = [...prev];
        const target = { ...next[index] };

        if (field === 'distanceYards') {
          target.distanceYards = parseNumberOrNull(raw);
        } else {
          const parsed = Number(raw);
          // Keep invalid numbers as NaN for validator clarity.
          (target[field] as number) = Number.isFinite(parsed) ? parsed : Number.NaN;
        }

        next[index] = target;
        return next;
      });
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    const issues = validateForm(metadata, holes, isEditMode);
    if (issues.length > 0) {
      setValidationIssues(issues);
      return;
    }

    setSaving(true);
    setPageError(null);

    try {
      if (!isEditMode) {
        await coursesApi.createConfiguration(courseId, {
          name: metadata.name.trim(),
          teeColour: metadata.teeColour.trim(),
          courseRating: metadata.courseRating,
          slopeRating: metadata.slopeRating,
          holes: holes.map((hole) => ({
            holeNumber: hole.holeNumber,
            distanceYards: hole.distanceYards,
            par: hole.par,
            strokeIndex: hole.strokeIndex,
          })),
        });
      } else if (configId) {
        const metadataPayload: TeeConfigurationUpdatePayload = {
          name: metadata.name.trim(),
          teeColour: metadata.teeColour.trim(),
          courseRating: metadata.courseRating,
          slopeRating: metadata.slopeRating,
        };

        await coursesApi.updateConfiguration(configId, metadataPayload);
        await coursesApi.updateConfigurationHoles(
          configId,
          holes.map((hole) => ({
            id: String(hole.id),
            holeNumber: hole.holeNumber,
            distanceYards: hole.distanceYards,
            par: hole.par,
            strokeIndex: hole.strokeIndex,
          })),
        );
      }

      showSuccessToast(
        isEditMode ? 'Tee configuration updated' : 'Tee configuration created',
        isEditMode
          ? 'The tee configuration was saved successfully.'
          : 'The new tee configuration was created successfully.',
      );
      navigate(`/courses/${courseId}`);
    } catch (error) {
      const message = handleApiError(error);
      setPageError(message);
      showErrorToast('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  if (!courseId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <Button variant="secondary" onClick={() => navigate('/courses')}>
            Back to Courses
          </Button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-300">Course ID is missing.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <Button variant="secondary" onClick={() => navigate(`/courses/${courseId}`)}>
            Back to Course
          </Button>
        </div>
        <SkeletonForm fields={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Configure tee metadata and hole setup.</p>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/courses/${courseId}`)}>
          Back to Course
        </Button>
      </div>

      {pageError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-300">{pageError}</p>
        </div>
      )}

      {validationIssues.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20" role="alert">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">Please fix the following validation errors:</p>
          <ul className="mt-2 list-disc pl-5 text-sm text-red-700 dark:text-red-300">
            {validationIssues.map((issue) => (
              <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6" noValidate>
        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Configuration Metadata</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="config-name">
                Name
              </label>
              <Input id="config-name" value={metadata.name} onChange={handleMetadataChange('name')} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="config-tee-colour">
                Tee Colour
              </label>
              <Input id="config-tee-colour" value={metadata.teeColour} onChange={handleMetadataChange('teeColour')} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="config-course-rating">
                Course Rating
              </label>
              <Input
                id="config-course-rating"
                type="number"
                step="0.1"
                min="0"
                value={metadata.courseRating === null ? '' : String(metadata.courseRating)}
                onChange={handleMetadataChange('courseRating')}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="config-slope-rating">
                Slope Rating
              </label>
              <Input
                id="config-slope-rating"
                type="number"
                min="1"
                value={metadata.slopeRating === null ? '' : String(metadata.slopeRating)}
                onChange={handleMetadataChange('slopeRating')}
              />
            </div>

            {!isEditMode && (
              <div className="md:col-span-2">
                <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hole Count</span>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="holeCount"
                      value="9"
                      checked={metadata.holeCount === 9}
                      onChange={handleHoleCountChange}
                    />
                    9 holes
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="holeCount"
                      value="18"
                      checked={metadata.holeCount === 18}
                      onChange={handleHoleCountChange}
                    />
                    18 holes
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Hole Setup</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Edit distance, par, and stroke index for each hole.</p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-400">
                  <th className="px-2 py-2">Hole</th>
                  <th className="px-2 py-2">Distance (yds)</th>
                  <th className="px-2 py-2">Par</th>
                  <th className="px-2 py-2">Stroke Index</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {holes.map((hole, index) => (
                  <tr key={hole.id || `hole-${index}`} className="transition-colors hover:bg-teal-50 dark:hover:bg-slate-800">
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Hole ${index + 1} number`}
                        type="number"
                        min="1"
                        max="18"
                        value={String(hole.holeNumber)}
                        onChange={handleHoleChange(index, 'holeNumber')}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Hole ${index + 1} distance`}
                        type="number"
                        min="0"
                        value={hole.distanceYards === null ? '' : String(hole.distanceYards)}
                        onChange={handleHoleChange(index, 'distanceYards')}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Hole ${index + 1} par`}
                        type="number"
                        min="3"
                        max="5"
                        value={String(hole.par)}
                        onChange={handleHoleChange(index, 'par')}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        aria-label={`Hole ${index + 1} stroke index`}
                        type="number"
                        min="1"
                        max="18"
                        value={String(hole.strokeIndex)}
                        onChange={handleHoleChange(index, 'strokeIndex')}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Configuration'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(`/courses/${courseId}`)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CourseTeeConfigEditorPage;
