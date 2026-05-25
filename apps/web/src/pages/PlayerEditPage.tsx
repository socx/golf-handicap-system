import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { handleApiError } from '../api/client';
import { playersApi, type Player, type PlayerUpdatePayload } from '../api/players';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SkeletonForm } from '../components/ui/Skeleton';
import { showSuccessToast, showErrorToast } from '../lib/toast';

interface FieldError {
  field: string;
  message: string;
}

function getFieldError(errors: FieldError[], field: string): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

function validateForm(values: PlayerUpdatePayload): FieldError[] {
  const errors: FieldError[] = [];

  if (!values.first_name?.trim()) {
    errors.push({ field: 'first_name', message: 'First name is required.' });
  }

  if (!values.last_name?.trim()) {
    errors.push({ field: 'last_name', message: 'Last name is required.' });
  }

  if (!values.country?.trim()) {
    errors.push({ field: 'country', message: 'Country is required.' });
  } else if (values.country.trim().length !== 2) {
    errors.push({ field: 'country', message: 'Country must be a 2-letter ISO code.' });
  }

  if (values.email && values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' });
  }

  if (values.handicap_index !== null && values.handicap_index !== undefined) {
    const v = Number(values.handicap_index);
    if (Number.isNaN(v) || v < -10 || v > 54) {
      errors.push({ field: 'handicap_index', message: 'Handicap index must be between -10 and 54.' });
    }
  }

  return errors;
}

function playerToFormValues(player: Player): PlayerUpdatePayload {
  return {
    first_name: player.first_name ?? '',
    last_name: player.last_name ?? '',
    middle_name: player.middle_name ?? '',
    dob: player.dob ?? '',
    gender: player.gender ?? '',
    club: player.club ?? '',
    email: player.email ?? '',
    country: player.country ?? '',
    handicap_index: player.handicap_index ?? null,
  };
}

export const PlayerEditPage: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();

  const [player, setPlayer] = useState<Player | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [values, setValues] = useState<PlayerUpdatePayload>({});
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const p = await playersApi.get(playerId);
        if (cancelled) return;
        setPlayer(p);
        setValues(playerToFormValues(p));
      } catch (err) {
        if (cancelled) return;
        setLoadError(handleApiError(err));
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [playerId]);

  const handleChange = (field: keyof PlayerUpdatePayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const raw = e.target.value;
    setValues((prev) => ({
      ...prev,
      [field]: field === 'handicap_index' ? (raw === '' ? null : Number(raw)) : raw,
    }));
    setFieldErrors((prev) => prev.filter((fe) => fe.field !== field));
    setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerId) return;

    const errors = validateForm(values);
    if (errors.length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setServerError(null);

    try {
      await playersApi.update(playerId, values);
      showSuccessToast('Player updated', `${values.first_name} ${values.last_name} has been updated.`);
      navigate('/players');
    } catch (err) {
      setServerError(handleApiError(err));
      showErrorToast('Update failed', handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!playerId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Edit Player</h2>
          <Button variant="secondary" onClick={() => navigate('/players')}>Back to Players</Button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Player ID is missing.</p>
        </div>
      </div>
    );
  }

  const loading = !player && !loadError;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Edit Player</h2>
          <Button variant="secondary" onClick={() => navigate('/players')}>Back to Players</Button>
        </div>
        <SkeletonForm fields={8} />
      </div>
    );
  }

  if (loadError || !player) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-slate-900">Edit Player</h2>
          <Button variant="secondary" onClick={() => navigate('/players')}>Back to Players</Button>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{loadError ?? 'Player not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Edit Player</h2>
          <p className="mt-1 text-sm text-slate-600">
            {player.first_name} {player.last_name}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/players')}>
          Back to Players
        </Button>
      </div>

      {serverError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{serverError}</p>
        </div>
      )}

      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6" noValidate>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="first_name" className="text-sm font-medium text-slate-700">
              First name <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <Input
              id="first_name"
              value={String(values.first_name ?? '')}
              onChange={handleChange('first_name')}
              aria-describedby={getFieldError(fieldErrors, 'first_name') ? 'first_name-error' : undefined}
            />
            {getFieldError(fieldErrors, 'first_name') && (
              <p id="first_name-error" role="alert" className="text-xs text-red-600">
                {getFieldError(fieldErrors, 'first_name')}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="last_name" className="text-sm font-medium text-slate-700">
              Last name <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <Input
              id="last_name"
              value={String(values.last_name ?? '')}
              onChange={handleChange('last_name')}
              aria-describedby={getFieldError(fieldErrors, 'last_name') ? 'last_name-error' : undefined}
            />
            {getFieldError(fieldErrors, 'last_name') && (
              <p id="last_name-error" role="alert" className="text-xs text-red-600">
                {getFieldError(fieldErrors, 'last_name')}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="middle_name" className="text-sm font-medium text-slate-700">
              Middle name
            </label>
            <Input
              id="middle_name"
              value={String(values.middle_name ?? '')}
              onChange={handleChange('middle_name')}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">
              Email
            </label>
            <Input
              id="email"
              type="email"
              value={String(values.email ?? '')}
              onChange={handleChange('email')}
              aria-describedby={getFieldError(fieldErrors, 'email') ? 'email-error' : undefined}
            />
            {getFieldError(fieldErrors, 'email') && (
              <p id="email-error" role="alert" className="text-xs text-red-600">
                {getFieldError(fieldErrors, 'email')}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="dob" className="text-sm font-medium text-slate-700">
              Date of birth
            </label>
            <Input
              id="dob"
              type="date"
              value={String(values.dob ?? '')}
              onChange={handleChange('dob')}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="gender" className="text-sm font-medium text-slate-700">
              Gender
            </label>
            <Input
              id="gender"
              value={String(values.gender ?? '')}
              onChange={handleChange('gender')}
              placeholder="e.g. male, female, other"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="club" className="text-sm font-medium text-slate-700">
              Club
            </label>
            <Input
              id="club"
              value={String(values.club ?? '')}
              onChange={handleChange('club')}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="country" className="text-sm font-medium text-slate-700">
              Country <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <Input
              id="country"
              value={String(values.country ?? '')}
              onChange={handleChange('country')}
              maxLength={2}
              placeholder="2-letter ISO code"
              aria-describedby={getFieldError(fieldErrors, 'country') ? 'country-error' : undefined}
            />
            {getFieldError(fieldErrors, 'country') && (
              <p id="country-error" role="alert" className="text-xs text-red-600">
                {getFieldError(fieldErrors, 'country')}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="handicap_index" className="text-sm font-medium text-slate-700">
              Handicap index
            </label>
            <Input
              id="handicap_index"
              type="number"
              step="0.1"
              min="-10"
              max="54"
              value={values.handicap_index === null || values.handicap_index === undefined ? '' : String(values.handicap_index)}
              onChange={handleChange('handicap_index')}
              aria-describedby={getFieldError(fieldErrors, 'handicap_index') ? 'handicap_index-error' : undefined}
            />
            {getFieldError(fieldErrors, 'handicap_index') && (
              <p id="handicap_index-error" role="alert" className="text-xs text-red-600">
                {getFieldError(fieldErrors, 'handicap_index')}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/players')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PlayerEditPage;
