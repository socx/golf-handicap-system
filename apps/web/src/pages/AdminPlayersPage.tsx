import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playersApi, type Player } from '../api/players';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/Table';
import { showErrorToast, showSuccessToast } from '../lib/toast';
import { Users, Pencil, Link2, Trash2 } from '../components/ui/icons';

const PAGE_SIZE = 20;

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
