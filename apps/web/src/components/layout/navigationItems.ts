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
  Activity,
} from '../ui/icons';
import type { User } from '../../lib/authStorage';

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: ReadonlyArray<User['role']>;
  superAdminOnly?: boolean;
}

export const ALL_NAVIGATION_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'player', 'viewer'] },
  { to: '/players', label: 'Players', icon: Users, roles: ['admin', 'player'] },
  { to: '/courses', label: 'Courses', icon: Flag, roles: ['admin', 'player', 'viewer'] },
  { to: '/rounds', label: 'Rounds', icon: ClipboardList, roles: ['admin', 'player'] },
  { to: '/handicap', label: 'Handicap', icon: TrendingUp, roles: ['admin', 'player'] },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin', 'player', 'viewer'] },
  { to: '/whats-new', label: 'What\'s New', icon: Logs, roles: ['admin', 'player', 'viewer'] },
  { to: '/feedback', label: 'Feedback', icon: Activity, roles: ['admin', 'player', 'viewer'] },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, roles: ['admin'] },
  { to: '/admin/users', label: 'Admin Users', icon: UserCog, roles: ['admin'] },
  { to: '/admin/settings', label: 'Admin Settings', icon: SlidersHorizontal, roles: ['admin'] },
  { to: '/admin/release-notes', label: 'Admin Release Notes', icon: Logs, roles: ['admin'] },
  { to: '/admin/feedback', label: 'Admin Feedback', icon: Activity, roles: ['admin'] },
  { to: '/admin/system-health', label: 'System Health', icon: Activity, roles: ['admin'], superAdminOnly: true },
] satisfies ReadonlyArray<NavigationItem>;

export const getFilteredNavigationItems = (user: User | null) => {
  if (!user?.role) {
    return [];
  }

  return ALL_NAVIGATION_ITEMS.filter((item) => {
    const roleAllowed = item.roles.some((itemRole) => itemRole === user.role);
    if (!roleAllowed) return false;
    if (!item.superAdminOnly) return true;
    return user.is_super_admin === true;
  });
};
