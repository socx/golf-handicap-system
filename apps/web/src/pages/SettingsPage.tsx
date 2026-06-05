import React, { useEffect, useState } from 'react';
import { authApi, type NotificationPreferences } from '../api/auth';
import { Button, Card, CardBody, CardHeader, Input } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { showErrorToast, showSuccessToast } from '../lib/toast';

const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();

  // Profile
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileSaving, setProfileSaving] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Notification preferences
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    handicap_updates_enabled: false,
    round_submitted_enabled: false,
    round_approved_enabled: false,
    marketing_enabled: false,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

  // Theme
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    void (async () => {
      try {
        const res = await authApi.getNotificationPreferences();
        setPrefs(res.data.preferences);
      } catch {
        showErrorToast('Failed to load preferences', 'Could not load your notification preferences.');
      } finally {
        setPrefsLoading(false);
      }
    })();
  }, []);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showErrorToast('Invalid email', 'Email address cannot be empty.');
      return;
    }
    setProfileSaving(true);
    try {
      await authApi.updateProfile(email.trim());
      await refreshUser();
      showSuccessToast('Profile updated', 'Your email address has been saved.');
    } catch {
      showErrorToast('Failed to update profile', 'Could not update your email address.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showErrorToast('Password too short', 'New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showErrorToast('Passwords do not match', 'New password and confirmation must be identical.');
      return;
    }
    setPasswordSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showSuccessToast('Password changed', 'Your password has been updated successfully.');
    } catch {
      showErrorToast('Failed to change password', 'Check your current password and try again.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handlePrefChange = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePrefsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsSaving(true);
    try {
      const res = await authApi.updateNotificationPreferences(prefs);
      setPrefs(res.data.preferences);
      showSuccessToast('Preferences saved', 'Your notification preferences have been updated.');
    } catch {
      showErrorToast('Failed to save preferences', 'Could not update your notification preferences.');
    } finally {
      setPrefsSaving(false);
    }
  };

  const handleThemeToggle = () => {
    const nowDark = !isDark;
    setIsDark(nowDark);
    document.documentElement.classList.toggle('dark', nowDark);
    localStorage.setItem('ghs-theme', nowDark ? 'dark' : 'light');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Manage your profile, password, notifications, and display preferences.
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Profile</h3>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <Input
              label="Email address"
              type="email"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Button type="submit" variant="primary" disabled={profileSaving}>
              {profileSaving ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Change password</h3>
        </CardHeader>
        <CardBody>
          <form onSubmit={handlePasswordSave} className="space-y-4">
            <Input
              label="Current password"
              type="password"
              aria-label="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Input
              label="New password"
              type="password"
              aria-label="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Input
              label="Confirm new password"
              type="password"
              aria-label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Button type="submit" variant="primary" disabled={passwordSaving}>
              {passwordSaving ? 'Saving…' : 'Change password'}
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Notification preferences */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Notification preferences</h3>
        </CardHeader>
        <CardBody>
          {prefsLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
          ) : (
            <form onSubmit={handlePrefsSave} className="space-y-4">
              {(
                [
                  { key: 'handicap_updates_enabled', label: 'Handicap calculated' },
                  { key: 'round_submitted_enabled', label: 'Round submitted' },
                  { key: 'round_approved_enabled', label: 'Round approved' },
                  { key: 'marketing_enabled', label: 'Marketing updates' },
                ] as Array<{ key: keyof NotificationPreferences; label: string }>
              ).map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={label}
                    checked={prefs[key]}
                    onChange={() => handlePrefChange(key)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                </label>
              ))}
              <Button type="submit" variant="primary" disabled={prefsSaving}>
                {prefsSaving ? 'Saving…' : 'Save preferences'}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Appearance</h3>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Current theme: <strong>{isDark ? 'Dark' : 'Light'}</strong>
            </span>
            <Button type="button" variant="secondary" onClick={handleThemeToggle} aria-label="Toggle theme">
              Switch to {isDark ? 'light' : 'dark'} mode
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default SettingsPage;
