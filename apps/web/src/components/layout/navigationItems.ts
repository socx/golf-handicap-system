import type { User } from '../../lib/authStorage';

export const ALL_NAVIGATION_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', roles: ['admin', 'player', 'viewer'] as const },
  { to: '/players', label: 'Players', roles: ['admin', 'player'] as const },
  { to: '/courses', label: 'Courses', roles: ['admin', 'player', 'viewer'] as const },
  { to: '/rounds', label: 'Rounds', roles: ['admin', 'player'] as const },
  { to: '/handicap', label: 'Handicap', roles: ['admin', 'player'] as const },
  { to: '/settings', label: 'Settings', roles: ['admin', 'player', 'viewer'] as const },
  { to: '/admin', label: 'Admin', roles: ['admin'] as const },
  { to: '/admin/settings', label: 'Admin Settings', roles: ['admin'] as const },
];

export const getFilteredNavigationItems = (role: User['role'] | null) => {
  if (!role) {
    return [];
  }
  return ALL_NAVIGATION_ITEMS.filter((item) => item.roles.includes(role));
};
