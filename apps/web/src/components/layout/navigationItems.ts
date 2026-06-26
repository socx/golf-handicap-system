import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  UserCog,
  Flag,
  ClipboardList,
  TrendingUp,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Logs,
} from '../ui/icons';
import type { User } from '../../lib/authStorage';

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: ReadonlyArray<User['role']>;
}

export const ALL_NAVIGATION_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'player', 'viewer'] },
  { to: '/players', label: 'Players', icon: Users, roles: ['admin', 'player'] },
  { to: '/courses', label: 'Courses', icon: Flag, roles: ['admin', 'player', 'viewer'] },
  { to: '/rounds', label: 'Rounds', icon: ClipboardList, roles: ['admin', 'player'] },
  { to: '/handicap', label: 'Handicap', icon: TrendingUp, roles: ['admin', 'player'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'player', 'viewer'] },
  { to: '/whats-new', label: 'What\'s New', icon: Logs, roles: ['admin', 'player', 'viewer'] },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, roles: ['admin'] },
  { to: '/admin/users', label: 'Admin Users', icon: UserCog, roles: ['admin'] },
  { to: '/admin/settings', label: 'Admin Settings', icon: SlidersHorizontal, roles: ['admin'] },
  { to: '/admin/release-notes', label: 'Admin Release Notes', icon: Logs, roles: ['admin'] },
] satisfies ReadonlyArray<NavigationItem>;

export const getFilteredNavigationItems = (role: User['role'] | null) => {
  if (!role) {
    return [];
  }
  return ALL_NAVIGATION_ITEMS.filter((item) => item.roles.some((itemRole) => itemRole === role));
};
