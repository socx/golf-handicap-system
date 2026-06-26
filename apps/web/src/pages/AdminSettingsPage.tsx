import React, { useEffect, useState } from 'react';
import { adminSettingsApi, type AdminSystemSettings } from '../api/adminSettings';
import { Button, Card, CardBody, CardHeader, Input } from '../components/ui';
import { Icon } from '../components/ui/Icon';
import { Save } from '../components/ui/icons';
import { showErrorToast, showSuccessToast } from '../lib/toast';

const defaultSettings: AdminSystemSettings = {
  pccOverride: null,
  notificationSettings: {
    round_submitted: true,
    round_approved: true,
    maintenance_alerts: true,
  },
  maintenanceMode: false,
  maintenanceMessage: 'Scheduled maintenance is in progress. Some features may be temporarily unavailable.',
  updatedAt: '',
};

function parsePccOverride(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < -1 || parsed > 3) {
    throw new Error('PCC override must be an integer between -1 and 3.');
  }
  return parsed;
}

const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AdminSystemSettings>(defaultSettings);
  const [pccOverrideInput, setPccOverrideInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await adminSettingsApi.get();
        if (cancelled) return;
        const loaded = response.data.settings;
        setSettings(loaded);
        setPccOverrideInput(loaded.pccOverride === null ? '' : String(loaded.pccOverride));
      } catch {
        if (cancelled) return;
        showErrorToast('Load failed', 'Unable to load admin settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleNotificationToggle = (key: keyof AdminSystemSettings['notificationSettings']) => {
    setSettings((prev) => ({
      ...prev,
      notificationSettings: {
        ...prev.notificationSettings,
        [key]: !prev.notificationSettings[key],
      },
    }));
  };

  const handleMaintenanceToggle = () => {
    setSettings((prev) => ({ ...prev, maintenanceMode: !prev.maintenanceMode }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      const pccOverride = parsePccOverride(pccOverrideInput);
      const response = await adminSettingsApi.update({
        pccOverride,
        notificationSettings: settings.notificationSettings,
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage.trim(),
      });

      const updated = response.data.settings;
      setSettings(updated);
      setPccOverrideInput(updated.pccOverride === null ? '' : String(updated.pccOverride));
      showSuccessToast('Settings saved', 'System settings were updated successfully.');
    } catch (error) {
      showErrorToast('Save failed', error instanceof Error ? error.message : 'Unable to save admin settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin: System settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure global options for PCC, notifications, and maintenance mode.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Global settings</h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading settings…</p>
          ) : (
            <form onSubmit={handleSave} className="space-y-5">
              <Input
                label="PCC override"
                aria-label="PCC override"
                placeholder="Blank uses calculated PCC"
                value={pccOverrideInput}
                onChange={(e) => setPccOverrideInput(e.target.value)}
              />

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Notification settings</p>

                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    aria-label="Round submitted notifications"
                    checked={settings.notificationSettings.round_submitted}
                    onChange={() => handleNotificationToggle('round_submitted')}
                  />
                  Round submitted notifications
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    aria-label="Round approved notifications"
                    checked={settings.notificationSettings.round_approved}
                    onChange={() => handleNotificationToggle('round_approved')}
                  />
                  Round approved notifications
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    aria-label="Maintenance alerts"
                    checked={settings.notificationSettings.maintenance_alerts}
                    onChange={() => handleNotificationToggle('maintenance_alerts')}
                  />
                  Maintenance alerts
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Maintenance mode</p>
                <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    aria-label="Maintenance mode"
                    checked={settings.maintenanceMode}
                    onChange={handleMaintenanceToggle}
                  />
                  Enable maintenance mode
                </label>

                <Input
                  label="Maintenance message"
                  aria-label="Maintenance message"
                  placeholder="Message shown to users while maintenance mode is enabled"
                  value={settings.maintenanceMessage}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      maintenanceMessage: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {settings.updatedAt ? `Last updated: ${new Date(settings.updatedAt).toLocaleString()}` : 'Not updated yet'}
                </p>
                <Button type="submit" variant="primary" disabled={saving}>
                  <Icon icon={Save} size="sm" />
                  {saving ? 'Saving…' : 'Save settings'}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default AdminSettingsPage;
