import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playersApi, type BackgroundImportResponse, type Player, type PlayerImportResponse } from '../api/players';
import { authApi } from '../api/auth';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/Table';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { Users, Pencil, Link2, Trash2, Plus } from '../components/ui/icons';

const PAGE_SIZE = 20;
const SMALL_IMPORT_THRESHOLD = 100;

interface ProvisionFormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  country: string;
  club: string;
}

const defaultProvisionForm: ProvisionFormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  country: 'GB',
  club: '',
};

export const AdminPlayersPage: React.FC = () => {
  const navigate = useNavigate();

  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [club, setClub] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Link user modal
  const [linkTarget, setLinkTarget] = useState<Player | null>(null);
  const [linkUserId, setLinkUserId] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [provisionForm, setProvisionForm] = useState<ProvisionFormState>(defaultProvisionForm);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [importCsvText, setImportCsvText] = useState('name,dob,gender,club,email,country\n');
  const [importResult, setImportResult] = useState<PlayerImportResponse | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importPhase, setImportPhase] = useState<'idle' | 'in_progress' | 'queued' | 'complete'>('idle');
  const [importProgress, setImportProgress] = useState(0);
  const [importProgressText, setImportProgressText] = useState('');
  const [importQueueInfo, setImportQueueInfo] = useState<BackgroundImportResponse | null>(null);
  const importProgressRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (importProgressRef.current !== null) {
        window.clearInterval(importProgressRef.current);
      }
    },
    [],
  );

  const fetchPlayers = async (opts?: { resetPage?: boolean }) => {
    const currentPage = opts?.resetPage ? 1 : page;
    try {
      const result = await playersApi.list({
        page: currentPage,
        limit: PAGE_SIZE,
        search: search || undefined,
        club: club || undefined,
        country: country || undefined,
      });
      setPlayers(result.players);
      setPagination(result.pagination);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch players');
      setPlayers([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    playersApi
      .list({ page, limit: PAGE_SIZE, search: search || undefined, club: club || undefined, country: country || undefined })
      .then((result) => {
        if (cancelled) return;
        setPlayers(result.players);
        setPagination(result.pagination);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch players');
        setPlayers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [page, search, club, country]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
    setPlayers(null);
  };

  const handleClubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClub(e.target.value);
    setPage(1);
    setPlayers(null);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCountry(e.target.value.toUpperCase());
    setPage(1);
    setPlayers(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await playersApi.delete(deleteTarget.id);
      showSuccessToast(`Player ${deleteTarget.first_name} ${deleteTarget.last_name} deleted.`);
      setDeleteTarget(null);
      await fetchPlayers();
    } catch (err) {
      showErrorToast('Delete failed', err instanceof Error ? err.message : 'Failed to delete player');
    } finally {
      setIsDeleting(false);
    }
  };

  const openLinkModal = (player: Player) => {
    setLinkTarget(player);
    setLinkUserId(player.user_id ?? '');
  };

  const confirmLink = async () => {
    if (!linkTarget) return;
    setIsLinking(true);
    try {
      const userId = linkUserId.trim() || null;
      await playersApi.linkUser(linkTarget.id, userId);
      showSuccessToast(userId ? 'User linked to player.' : 'User unlinked from player.');
      setLinkTarget(null);
      setLinkUserId('');
      await fetchPlayers();
    } catch (err) {
      showErrorToast('Link update failed', err instanceof Error ? err.message : 'Failed to link/unlink user');
    } finally {
      setIsLinking(false);
    }
  };

  const updateProvisionField = <K extends keyof ProvisionFormState>(field: K, value: ProvisionFormState[K]) => {
    setProvisionForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleProvisionLinkedAccount = async (event: React.FormEvent) => {
    event.preventDefault();

    const email = provisionForm.email.trim().toLowerCase();
    const password = provisionForm.password;
    const firstName = provisionForm.firstName.trim();
    const lastName = provisionForm.lastName.trim();
    const country = provisionForm.country.trim().toUpperCase();
    const club = provisionForm.club.trim();

    if (!email || !password || !firstName || !lastName || !country) {
      showErrorToast('Missing details', 'Email, password, first name, last name, and country are required.');
      return;
    }

    setIsProvisioning(true);
    try {
      const registration = await authApi.register(email, password, 'player');
      const linkedUserId = registration.data.user.id;

      await playersApi.create({
        first_name: firstName,
        last_name: lastName,
        country,
        club: club || null,
        email,
        user_id: linkedUserId,
      });

      showSuccessToast('Player provisioned', 'Created linked user and player profile successfully.');
      setProvisionForm(defaultProvisionForm);
      await fetchPlayers({ resetPage: true });
    } catch (error) {
      showErrorToast('Provisioning failed', error instanceof Error ? error.message : 'Unable to create linked user/player.');
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      setImportCsvText(text);
    } catch (error) {
      showErrorToast('Unable to read CSV', error instanceof Error ? error.message : 'Failed to read selected file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportPlayers = async (dryRun: boolean) => {
    const csvText = importCsvText.trim();
    if (!csvText) {
      showErrorToast('Missing CSV', 'Paste CSV content or choose a CSV file first.');
      return;
    }

    const nonEmptyLines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const rowCount = Math.max(0, nonEmptyLines.length - 1);

    setIsImporting(true);
    setImportResult(null);
    setImportQueueInfo(null);
    setImportPhase('idle');
    setImportProgress(0);
    setImportProgressText('');

    if (!dryRun && rowCount > 0 && rowCount <= SMALL_IMPORT_THRESHOLD) {
      const animationDurationMs = Math.max(500, Math.min(3000, rowCount * 20));
      const startedAt = Date.now();
      setImportPhase('in_progress');
      setImportProgress(1);
      setImportProgressText(`Importing row 1 of ${rowCount}...`);

      if (importProgressRef.current !== null) {
        window.clearInterval(importProgressRef.current);
      }

      importProgressRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const ratio = Math.min(1, elapsed / animationDurationMs);
        const targetPercent = Math.min(88, Math.max(1, Math.round(ratio * 88)));
        const currentRow = Math.max(1, Math.min(rowCount, Math.round((targetPercent / 88) * rowCount)));

        setImportProgress(targetPercent);
        setImportProgressText(`Importing row ${currentRow} of ${rowCount}...`);

        if (ratio >= 1 && importProgressRef.current !== null) {
          window.clearInterval(importProgressRef.current);
          importProgressRef.current = null;
          setImportProgress(88);
          setImportProgressText('Finalizing import...');
        }
      }, 50);
    }

    try {
      const result = await playersApi.importCsv(csvText, dryRun);

      if (importProgressRef.current !== null) {
        window.clearInterval(importProgressRef.current);
        importProgressRef.current = null;
      }

      if ('queued' in result && result.queued) {
        setImportPhase('queued');
        setImportQueueInfo(result);
        setImportProgress(0);
        setImportProgressText('');
        showSuccessToast('Import queued', result.message);
        return;
      }

      const syncResult = result as PlayerImportResponse;
      setImportResult(syncResult);
      setImportPhase('complete');

      if (dryRun) {
        showSuccessToast('Validation complete', `${syncResult.summary.validRows ?? 0} valid rows, ${syncResult.summary.invalidRows ?? 0} invalid rows.`);
      } else {
        setImportProgress(100);
        setImportProgressText(`Import complete: ${syncResult.summary.importedRows ?? 0} of ${syncResult.summary.rowCount} rows imported.`);
        showSuccessToast('Players imported', `Imported ${syncResult.summary.importedRows ?? 0} player records.`);
        await fetchPlayers({ resetPage: true });
      }
    } catch (error) {
      if (importProgressRef.current !== null) {
        window.clearInterval(importProgressRef.current);
        importProgressRef.current = null;
      }
      setImportPhase('idle');
      setImportProgress(0);
      setImportProgressText('');
      setImportResult(null);
      showErrorToast('Import failed', error instanceof Error ? error.message : 'Unable to import player CSV.');
    } finally {
      setIsImporting(false);
    }
  };

  const loading = players === null && !error;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Icon icon={Users} size="lg" className="text-teal-600 dark:text-teal-400" />
          Admin: Players
        </h1>
        <p className="text-sm text-gray-500 mt-1">Manage all players — edit details, delete records, or link to user accounts.</p>
      </div>

      <form className="rounded-xl border border-slate-200 p-4 dark:border-slate-800" onSubmit={(event) => void handleProvisionLinkedAccount(event)}>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={Plus} size="sm" className="text-teal-600 dark:text-teal-400" />
          Create linked user and player
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Creates a player user account, creates the player profile, and links them in one step.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Input
            label="Email"
            type="email"
            value={provisionForm.email}
            onChange={(event) => updateProvisionField('email', event.target.value)}
            autoComplete="email"
            required
          />
          <Input
            label="Temporary password"
            type="password"
            value={provisionForm.password}
            onChange={(event) => updateProvisionField('password', event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Input
            label="Country"
            value={provisionForm.country}
            onChange={(event) => updateProvisionField('country', event.target.value.toUpperCase())}
            maxLength={2}
            required
          />
          <Input
            label="First name"
            value={provisionForm.firstName}
            onChange={(event) => updateProvisionField('firstName', event.target.value)}
            required
          />
          <Input
            label="Last name"
            value={provisionForm.lastName}
            onChange={(event) => updateProvisionField('lastName', event.target.value)}
            required
          />
          <Input
            label="Club"
            value={provisionForm.club}
            onChange={(event) => updateProvisionField('club', event.target.value)}
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={isProvisioning}>
            <Icon icon={Plus} size="sm" />
            {isProvisioning ? 'Creating linked account…' : 'Create linked account'}
          </Button>
        </div>
      </form>

      <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Import players from CSV</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Supports name, DOB, gender, club, email, and country columns. Run a dry run first to review validation errors before importing.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="player-import-csv">
            Player CSV
          </label>
          <textarea
            id="player-import-csv"
            className="min-h-48 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            value={importCsvText}
            onChange={(event) => setImportCsvText(event.target.value)}
            spellCheck={false}
          />
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" accept=".csv,text/csv" aria-label="Upload player CSV" onChange={(event) => void handleImportFile(event)} />
            <Button variant="secondary" onClick={() => void handleImportPlayers(true)} disabled={isImporting}>
              {isImporting ? 'Running…' : 'Dry run validation'}
            </Button>
            <Button onClick={() => void handleImportPlayers(false)} disabled={isImporting}>
              {isImporting ? 'Running…' : 'Import players'}
            </Button>
          </div>
        </div>

        {importPhase === 'in_progress' && (
          <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm dark:border-teal-900/60 dark:bg-teal-950/20">
            <p className="font-medium text-teal-800 dark:text-teal-200">Import in progress</p>
            <p className="mt-1 text-teal-700 dark:text-teal-300">{importProgressText}</p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-teal-100 dark:bg-teal-900/40">
              <div
                className="h-full rounded-full bg-teal-600 transition-all duration-200 dark:bg-teal-400"
                style={{ width: `${importProgress}%` }}
                aria-label="Import progress"
              />
            </div>
            <p className="mt-2 text-xs text-teal-700 dark:text-teal-300">{importProgress}% complete</p>
          </div>
        )}

        {importPhase === 'queued' && importQueueInfo && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/60 dark:bg-amber-950/20">
            <p className="font-medium text-amber-800 dark:text-amber-200">Large import queued</p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">{importQueueInfo.message}</p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Job ID: <span className="font-mono">{importQueueInfo.jobId}</span>
            </p>
          </div>
        )}

        {importResult && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/50">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {importResult.dryRun ? 'Dry run summary' : 'Import summary'}: {importResult.summary.rowCount} rows processed
            </p>
            {'validRows' in importResult.summary && (
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                {importResult.summary.validRows ?? 0} valid, {importResult.summary.invalidRows ?? 0} invalid, {importResult.summary.totalIssues ?? 0} issues found.
              </p>
            )}
            {'importedRows' in importResult.summary && (
              <p className="mt-1 text-slate-600 dark:text-slate-300">Imported {importResult.summary.importedRows ?? 0} players.</p>
            )}

            {importResult.rows && importResult.rows.length > 0 && (
              <div className="mt-3 space-y-2">
                {importResult.rows.map((row) => (
                  <div key={row.rowNumber} className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Row {row.rowNumber}: {row.values.first_name} {row.values.last_name}
                    </p>
                    {row.issues.length === 0 ? (
                      <p className="mt-1 text-emerald-700 dark:text-emerald-400">No validation issues.</p>
                    ) : (
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-red-700 dark:text-red-400">
                        {row.issues.map((issue, index) => (
                          <li key={`${row.rowNumber}-${issue.field}-${index}`}>
                            {issue.field}: {issue.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search name or email…"
          value={search}
          onChange={handleSearchChange}
          className="w-64"
          aria-label="Search players"
        />
        <Input
          placeholder="Club"
          value={club}
          onChange={handleClubChange}
          className="w-40"
          aria-label="Filter by club"
        />
        <Input
          placeholder="Country (2-letter)"
          value={country}
          onChange={handleCountryChange}
          className="w-44"
          maxLength={2}
          aria-label="Filter by country"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading ? (
        <SkeletonTable rows={8} columns={6} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Club</TableHeaderCell>
                <TableHeaderCell>Country</TableHeaderCell>
                <TableHeaderCell>Linked User</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {players && players.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No players found.
                  </TableCell>
                </TableRow>
              ) : (
                players?.map((player) => (
                  <TableRow key={player.id}>
                    <TableCell>
                      {player.first_name} {player.last_name}
                    </TableCell>
                    <TableCell>{player.email ?? '—'}</TableCell>
                    <TableCell>{player.club ?? '—'}</TableCell>
                    <TableCell>{player.country}</TableCell>
                    <TableCell className="font-mono text-xs">{player.user_id ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/players/${player.id}/edit`)}
                          title="Edit player"
                          aria-label="Edit player"
                        >
                          <Icon icon={Pencil} size="sm" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openLinkModal(player)}
                          title={player.user_id ? 'Unlink user' : 'Link user'}
                          aria-label={player.user_id ? 'Unlink user' : 'Link user'}
                        >
                          <Icon icon={Link2} size="sm" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteTarget(player)}
                          title="Delete player"
                          aria-label="Delete player"
                        >
                          <Icon icon={Trash2} size="sm" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Player"
        size="sm"
      >
        <p className="text-sm">
          Are you sure you want to delete{' '}
          <strong>
            {deleteTarget?.first_name} {deleteTarget?.last_name}
          </strong>
          ? This action soft-deletes the player record.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void confirmDelete()} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Modal>

      {/* Link/unlink user modal */}
      <Modal
        isOpen={linkTarget !== null}
        onClose={() => { setLinkTarget(null); setLinkUserId(''); }}
        title={linkTarget?.user_id ? 'Unlink / Change Linked User' : 'Link User to Player'}
        size="md"
      >
        <p className="text-sm mb-3">
          Enter the User ID to link to{' '}
          <strong>
            {linkTarget?.first_name} {linkTarget?.last_name}
          </strong>
          , or clear the field to unlink.
        </p>
        <Input
          placeholder="User UUID (leave empty to unlink)"
          value={linkUserId}
          onChange={(e) => setLinkUserId(e.target.value)}
          aria-label="User ID"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setLinkTarget(null); setLinkUserId(''); }} disabled={isLinking}>
            Cancel
          </Button>
          <Button onClick={() => void confirmLink()} disabled={isLinking}>
            {isLinking ? 'Saving…' : linkUserId.trim() ? 'Link User' : 'Unlink User'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminPlayersPage;
