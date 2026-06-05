import type { User } from '../../lib/authStorage';

interface NavigationItem {
  to: string;
  label: string;
  roles: ReadonlyArray<User['role']>;
}

export const ALL_NAVIGATION_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', roles: ['admin', 'player', 'viewer'] },
  { to: '/players', label: 'Players', roles: ['admin', 'player'] },
  { to: '/courses', label: 'Courses', roles: ['admin', 'player', 'viewer'] },
  { to: '/rounds', label: 'Rounds', roles: ['admin', 'player'] },
  { to: '/handicap', label: 'Handicap', roles: ['admin', 'player'] },
  { to: '/settings', label: 'Settings', roles: ['admin', 'player', 'viewer'] },
  { to: '/admin', label: 'Admin', roles: ['admin'] },
  { to: '/admin/settings', label: 'Admin Settings', roles: ['admin'] },
] satisfies ReadonlyArray<NavigationItem>;

export const getFilteredNavigationItems = (role: User['role'] | null) => {
  if (!role) {
    return [];
  }
  return ALL_NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));
};
