import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { coursesApi, type Course, type CourseUpsertPayload } from '../api/courses';
import { handleApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SkeletonForm } from '../components/ui/Skeleton';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { useAuth } from '../hooks/useAuth';

interface FieldError {
  field: keyof CourseUpsertPayload;
  message: string;
}

const EMPTY_VALUES: CourseUpsertPayload = {
  name: '',
  address: '',
  city: '',
  country: '',
  phone: '',
  email: '',
  website: '',
};

function courseToFormValues(course: Course): CourseUpsertPayload {
  return {
    name: course.name ?? '',
    address: course.address ?? '',
    city: course.city ?? '',
    country: course.country ?? '',
    phone: course.phone ?? '',
    email: course.email ?? '',
    website: course.website ?? '',
  };
}

function getFieldError(errors: FieldError[], field: keyof CourseUpsertPayload): string | undefined {
  return errors.find((error) => error.field === field)?.message;
}

function validateForm(values: CourseUpsertPayload): FieldError[] {
  const errors: FieldError[] = [];

  if (!values.name?.trim()) {
    errors.push({ field: 'name', message: 'Course name is required.' });
  }

  if (values.country && values.country.trim() && !/^[A-Za-z]{2}$/.test(values.country.trim())) {
    errors.push({ field: 'country', message: 'Country must be a 2-letter ISO code.' });
  }

  if (values.email && values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }

  if (values.website && values.website.trim()) {
    try {
      const url = new URL(values.website.trim());
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push({ field: 'website', message: 'Website URL must start with http:// or https://.' });
      }
    } catch {
      errors.push({ field: 'website', message: 'Enter a valid website URL.' });
    }
  }

  return errors;
}

function buildPayload(values: CourseUpsertPayload): CourseUpsertPayload {
  return {
    name: values.name?.trim() ?? '',
    address: values.address?.trim() ?? '',
    city: values.city?.trim() ?? '',
    country: values.country?.trim().toUpperCase() ?? '',
    phone: values.phone?.trim() ?? '',
    email: values.email?.trim() ?? '',
    website: values.website?.trim() ?? '',
  };
}

export const CourseFormPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const isEditMode = !!courseId;
  const [course, setCourse] = useState<Course | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<CourseUpsertPayload>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    if (!isEditMode || !courseId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const response = await coursesApi.get(courseId);
        if (cancelled) return;

        setCourse(response.data);
        setValues(courseToFormValues(response.data));
      } catch (error) {
        if (cancelled) return;
        setLoadError(handleApiError(error));
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [courseId, isAdmin, isEditMode]);

  const loading = isEditMode && !course && !loadError;
  const heading = useMemo(() => (isEditMode ? 'Edit Course' : 'Create Course'), [isEditMode]);

  const handleChange = (field: keyof CourseUpsertPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
    setFieldErrors((prev) => prev.filter((error) => error.field !== field));
    setServerError(null);
  };

  const handleCancel = () => {
    if (courseId) {
      navigate(`/courses/${courseId}`);
      return;
    }

    navigate('/courses');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAdmin) {
      setServerError('Only administrators can create or edit courses.');
      return;
    }

    const errors = validateForm(values);
    if (errors.length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setServerError(null);

    try {
      const payload = buildPayload(values);

      if (isEditMode && courseId) {
        const response = await coursesApi.update(courseId, payload);
        showSuccessToast('Course updated', `${response.data.name} has been updated.`);
        navigate(`/courses/${response.data.id}`);
        return;
      }

      const response = await coursesApi.create(payload);
      showSuccessToast('Course created', `${response.data.name} has been created.`);
      navigate(`/courses/${response.data.id}`);
    } catch (error) {
      const message = handleApiError(error);
      setServerError(message);
      showErrorToast('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Course Management</h2>
          <Button variant="secondary" onClick={() => navigate('/courses')}>Back to Courses</Button>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-sm text-amber-800 dark:text-amber-300">Only administrators can create or edit courses.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{heading}</h2>
          <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
        </div>
        <SkeletonForm fields={7} />
      </div>
    );
  }

  if (isEditMode && (loadError || !course)) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Edit Course</h2>
          <Button variant="secondary" onClick={() => navigate('/courses')}>Back to Courses</Button>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-300">{loadError ?? 'Course not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{heading}</h2>
          {isEditMode && course && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{course.name}</p>
          )}
        </div>

        <Button variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
      </div>

      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-300">{serverError}</p>
        </div>
      )}

      <form onSubmit={(event) => { void handleSubmit(event); }} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Course name <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <Input
              id="name"
              value={values.name ?? ''}
              onChange={handleChange('name')}
              aria-describedby={getFieldError(fieldErrors, 'name') ? 'name-error' : undefined}
            />
            {getFieldError(fieldErrors, 'name') && (
              <p id="name-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                {getFieldError(fieldErrors, 'name')}
              </p>
            )}
          </div>

          <div className="space-y-1 md:col-span-2">
            <label htmlFor="address" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Address
            </label>
            <Input id="address" value={values.address ?? ''} onChange={handleChange('address')} />
          </div>

          <div className="space-y-1">
            <label htmlFor="city" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              City
            </label>
            <Input id="city" value={values.city ?? ''} onChange={handleChange('city')} />
          </div>

          <div className="space-y-1">
            <label htmlFor="country" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Country
            </label>
            <Input
              id="country"
              value={values.country ?? ''}
              onChange={handleChange('country')}
              maxLength={2}
              placeholder="2-letter ISO code"
              aria-describedby={getFieldError(fieldErrors, 'country') ? 'country-error' : undefined}
            />
            {getFieldError(fieldErrors, 'country') && (
              <p id="country-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                {getFieldError(fieldErrors, 'country')}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="phone" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Phone
            </label>
            <Input id="phone" value={values.phone ?? ''} onChange={handleChange('phone')} />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={values.email ?? ''}
              onChange={handleChange('email')}
              aria-describedby={getFieldError(fieldErrors, 'email') ? 'email-error' : undefined}
            />
            {getFieldError(fieldErrors, 'email') && (
              <p id="email-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                {getFieldError(fieldErrors, 'email')}
              </p>
            )}
          </div>

          <div className="space-y-1 md:col-span-2">
            <label htmlFor="website" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Website
            </label>
            <Input
              id="website"
              value={values.website ?? ''}
              onChange={handleChange('website')}
              placeholder="https://example.com"
              aria-describedby={getFieldError(fieldErrors, 'website') ? 'website-error' : undefined}
            />
            {getFieldError(fieldErrors, 'website') && (
              <p id="website-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                {getFieldError(fieldErrors, 'website')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" isLoading={saving}>
            {isEditMode ? 'Save Changes' : 'Create Course'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CourseFormPage;