import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playersApi, type Player } from '../api/players';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Table, TableBody, TableHead } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { SkeletonTable } from '../components/ui/Skeleton';

const PAGE_SIZE = 10;

export const PlayersPage: React.FC = () => {
  const navigate = useNavigate();
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

  return (
    <div className="space-y-6" data-testid="players-page">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Players</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Browse player profiles with quick search and filters.</p>
      </div>

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
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 dark:border-slate-800 dark:text-slate-300">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Club</th>
                <th className="px-4 py-3 text-left">Country</th>
                <th className="px-4 py-3 text-left">Handicap</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </TableHead>
            <TableBody>
              {(players || []).map((player) => (
                <tr key={player.id} className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900/40">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {player.first_name} {player.last_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{player.email || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{player.club || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{player.country}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                    {typeof player.handicap_index === 'number' ? player.handicap_index.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="secondary" onClick={() => handleOpenProfile(player.id)} disabled={loading}>
                      View Profile
                    </Button>
                  </td>
                </tr>
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
