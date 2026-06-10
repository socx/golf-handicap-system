import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playersApi, type Player } from '../api/players';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { Users, Eye, Pencil } from '../components/ui/icons';
import { Table, TableBody, TableHead, TableRow, TableHeaderCell, TableCell } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/Skeleton';

const PAGE_SIZE = 10;

export const PlayersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPlayer = user?.role === 'player';
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [club, setClub] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchPlayers = async () => {
      setIsFetching(true);
      try {
        const result = await playersApi.list({
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          club: club || undefined,
          country: country || undefined,
        });

        if (cancelled) return;
        setPlayers(result.players);
        setPagination(result.pagination);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch players:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch players');
        setPlayers([]);
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    void fetchPlayers();

    return () => {
      cancelled = true;
    };
  }, [page, search, club, country]);

  const loading = players === null && !error;

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(1);
    setPlayers(null);
  };

  const handleClubChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setClub(event.target.value);
    setPage(1);
    setPlayers(null);
  };

  const handleCountryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCountry(event.target.value.toUpperCase());
    setPage(1);
    setPlayers(null);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    setPlayers(null);
  };

  const handleOpenProfile = (playerId: string) => {
    navigate(`/players/${playerId}`);
  };

  const ownPlayerId = user?.player_id ?? null;

  const handleOpenOwnProfile = () => {
    if (ownPlayerId) {
      navigate(`/players/${ownPlayerId}`);
    }
  };

  return (
    <div className="space-y-6" data-testid="players-page">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          <Icon icon={Users} size="lg" className="text-teal-600 dark:text-teal-400" />
          Players
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {isPlayer ? 'View your player profile and performance details.' : 'Browse player profiles with quick search and filters.'}
        </p>
      </div>

      {isPlayer ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-sm text-slate-700 dark:text-slate-300">Your account is scoped to your own player record.</p>
          <div className="mt-3">
            <Button onClick={handleOpenOwnProfile} disabled={!ownPlayerId}>
              <Icon icon={Eye} size="sm" />
              View My Profile
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input placeholder="Search by name or email..." value={search} onChange={handleSearchChange} />
        <Input placeholder="Filter by club..." value={club} onChange={handleClubChange} />
        <Input placeholder="Filter by country..." value={country} onChange={handleCountryChange} maxLength={2} />
      </div>

      {isFetching && players !== null && (
        <p className="text-xs text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
          Updating player results...
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {(players || []).length > 0 ? (
        <div className="space-y-4">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Email</TableHeaderCell>
                <TableHeaderCell>Club</TableHeaderCell>
                <TableHeaderCell>Country</TableHeaderCell>
                <TableHeaderCell>Handicap</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(players || []).map((player) => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">
                    {player.first_name} {player.last_name}
                  </TableCell>
                  <TableCell>{player.email || '—'}</TableCell>
                  <TableCell>{player.club || '—'}</TableCell>
                  <TableCell>{player.country}</TableCell>
                  <TableCell>
                    {typeof player.handicap_index === 'number' ? player.handicap_index.toFixed(1) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenProfile(player.id)}
                        disabled={loading}
                        title="View profile"
                        aria-label="View profile"
                      >
                        <Icon icon={Eye} size="sm" />
                      </Button>
                      {!isPlayer ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/players/${player.id}/edit`)}
                          disabled={loading}
                          title="Edit player"
                          aria-label="Edit player"
                        >
                          <Icon icon={Pencil} size="sm" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-center">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              loading={loading}
            />
          </div>
        </div>
      ) : loading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-sm text-slate-600 dark:text-slate-400">No players found</p>
        </div>
      )}
    </div>
  );
};

export default PlayersPage;
