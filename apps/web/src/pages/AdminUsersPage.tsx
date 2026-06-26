import React, { useEffect, useState } from 'react';
import { adminUsersApi, type AdminUser } from '../api/adminUsers';
import { authApi } from '../api/auth';
import { handleApiError } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/Table';
import { Icon } from '../components/ui/Icon';
import { UserCog } from '../components/ui/icons';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { setStoredUser, setTokens } from '../lib/authStorage';

const PAGE_SIZE = 20;

const AdminUsersPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | ''>('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchUsers = async () => {
      try {
        const response = await adminUsersApi.list({
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          role: role || undefined,
          status: status || undefined,
        });

        if (cancelled) return;
        setUsers(response.data.users);
        setPagination(response.data.pagination);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setUsers([]);
        setError(handleApiError(err));
      }
    };

    void fetchUsers();

    return () => {
      cancelled = true;
    };
  }, [page, search, role, status]);

  const loading = users === null && !error;

  const handleToggleActivation = async (target: AdminUser) => {
    setBusyUserId(target.id);
    try {
      const response = target.is_active
        ? await adminUsersApi.deactivate(target.id)
        : await adminUsersApi.activate(target.id);

      const updated = response.data.user;
      setUsers((previous) => (previous || []).map((item) => (item.id === updated.id ? updated : item)));

      if (!target.is_active) {
        if (response.data.notificationEmailSent) {
          showSuccessToast('User activated', 'Activation email sent to the user.');
        } else {
          showSuccessToast('User activated', 'User is active, but activation email could not be sent.');
        }
      } else {
        showSuccessToast('User deactivated', 'User has been deactivated successfully.');
      }
    } catch (err) {
      showErrorToast('Status update failed', handleApiError(err));
    } finally {
      setBusyUserId(null);
    }
  };

  const handleImpersonate = async (target: AdminUser) => {
    if (target.id === user?.id) {
      showErrorToast('Invalid target', 'Cannot impersonate your own account.');
      return;
    }

    setBusyUserId(target.id);
    try {
      const response = await authApi.startImpersonation(target.id);
      setTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken);
      setStoredUser(response.data.user);
      window.location.assign('/dashboard');
    } catch (err) {
      showErrorToast('Impersonation failed', handleApiError(err));
    } finally {
      setBusyUserId(null);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={UserCog} size="lg" className="text-teal-600 dark:text-teal-400" />
          Admin: Users
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Activate, reactivate, or deactivate users and review account status.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
            setUsers(null);
          }}
          className="w-64"
          aria-label="Search users"
        />
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
            setUsers(null);
          }}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="player">Player</option>
          <option value="viewer">Viewer</option>
        </select>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as 'active' | 'inactive' | '');
            setPage(1);
            setUsers(null);
          }}
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

      {loading ? (
        <SkeletonTable rows={8} columns={5} />
      ) : (
        <>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users?.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.email}</TableCell>
                    <TableCell>{row.role}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          row.is_active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}
                      >
                        {row.is_active ? 'active' : 'inactive'}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(row.created_at).toISOString().slice(0, 10)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={row.is_active ? 'secondary' : 'primary'}
                        onClick={() => void handleToggleActivation(row)}
                        disabled={busyUserId === row.id}
                      >
                        {busyUserId === row.id
                          ? 'Saving...'
                          : row.is_active
                            ? 'Deactivate'
                            : 'Activate'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleImpersonate(row)}
                        disabled={busyUserId === row.id || !row.is_active}
                      >
                        Impersonate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {pagination.totalPages > 1 ? (
            <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
};

export default AdminUsersPage;
