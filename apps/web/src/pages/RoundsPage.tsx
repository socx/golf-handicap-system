import React from 'react';
import { Card, CardBody, CardHeader, Input, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui';

interface ScorecardRow {
  id: string;
  player: string;
  course: string;
  tee: string;
  grossScore: number;
  netScore: number;
  status: 'Validated' | 'Pending';
}

const scorecards: ScorecardRow[] = [
  {
    id: 'RND-1024',
    player: 'Mia Turner',
    course: 'Royal Glen',
    tee: 'Blue',
    grossScore: 86,
    netScore: 73,
    status: 'Validated',
  },
  {
    id: 'RND-1025',
    player: 'Noah Patel',
    course: 'Coastal Dunes',
    tee: 'White',
    grossScore: 92,
    netScore: 77,
    status: 'Pending',
  },
  {
    id: 'RND-1026',
    player: 'Ava Brooks',
    course: 'Pine Valley',
    tee: 'Red',
    grossScore: 89,
    netScore: 74,
    status: 'Validated',
  },
];

export const RoundsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Rounds</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Enter and review scorecards with a mobile-first view for tablets and phones.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Round filters</h3>
        </CardHeader>
        <CardBody>
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Round filters form">
            <Input label="Player" placeholder="Search player" />
            <Select
              label="Course"
              placeholder="All courses"
              options={[
                { value: 'royal-glen', label: 'Royal Glen' },
                { value: 'coastal-dunes', label: 'Coastal Dunes' },
                { value: 'pine-valley', label: 'Pine Valley' },
              ]}
            />
            <Select
              label="Status"
              placeholder="Any status"
              options={[
                { value: 'validated', label: 'Validated' },
                { value: 'pending', label: 'Pending' },
              ]}
            />
            <Input label="Round date" type="date" />
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Scorecards</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-3 md:hidden" aria-label="Mobile scorecard list">
            {scorecards.map((round) => (
              <article
                key={round.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/70"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">{round.id}</p>
                    <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-100">{round.player}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{round.course} • {round.tee} tee</p>
                  </div>
                  <span
                    className={[
                      'rounded-full px-2.5 py-1 text-xs font-semibold',
                      round.status === 'Validated'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
                    ].join(' ')}
                  >
                    {round.status}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Gross</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">{round.grossScore}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Net</dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">{round.netScore}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden md:block" aria-label="Desktop scorecard table">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Round</TableHeaderCell>
                  <TableHeaderCell>Player</TableHeaderCell>
                  <TableHeaderCell>Course</TableHeaderCell>
                  <TableHeaderCell>Tee</TableHeaderCell>
                  <TableHeaderCell>Gross</TableHeaderCell>
                  <TableHeaderCell>Net</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scorecards.map((round) => (
                  <TableRow key={round.id}>
                    <TableCell>{round.id}</TableCell>
                    <TableCell>{round.player}</TableCell>
                    <TableCell>{round.course}</TableCell>
                    <TableCell>{round.tee}</TableCell>
                    <TableCell>{round.grossScore}</TableCell>
                    <TableCell>{round.netScore}</TableCell>
                    <TableCell>{round.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default RoundsPage;
