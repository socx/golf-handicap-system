/**
 * Central icon registry for the Golf Handicap System UI.
 *
 * Import all icons from this file, not directly from lucide-react.
 * This makes the full icon palette visible in one place and allows
 * global icon changes without touching every consumer file.
 *
 * Usage:
 *   import { Flag, Plus, ArrowLeft } from '../components/ui/icons';
 *   // or from the barrel:
 *   import { Flag, Plus, ArrowLeft } from '../components/ui';
 */

// ── Navigation ──────────────────────────────────────────────────────────────
export {
  LayoutDashboard,   // Dashboard
  Users,             // Players
  Flag,              // Courses
  ClipboardList,     // Rounds
  TrendingUp,        // Handicap
  Settings,          // Settings
  ShieldCheck,       // Admin
  SlidersHorizontal, // Admin Settings
} from 'lucide-react';

// ── CRUD actions ─────────────────────────────────────────────────────────────
export {
  Plus,    // Create / Add
  Pencil,  // Edit
  Copy,    // Duplicate / clone
  Save,    // Save / Update
  Trash2,  // Delete
  Eye,     // View
} from 'lucide-react';

// ── Navigation / flow ────────────────────────────────────────────────────────
export {
  ArrowLeft,    // Back
  ChevronLeft,  // Sub-back / breadcrumb
  ExternalLink, // Open in new tab
} from 'lucide-react';

// ── Round workflow ────────────────────────────────────────────────────────────
export {
  CheckCircle2 as CheckCircle, // Approve / success state
  XCircle,                     // Reject / error state
  ClipboardCheck,              // Approved rounds / reviewed
  FilePlus,                    // New round entry
} from 'lucide-react';

// ── User management ───────────────────────────────────────────────────────────
export {
  User,    // Single player profile
  UserCog, // Admin player management
  UserPen, // Edit player profile
  Link2,   // Link/unlink user account
} from 'lucide-react';

// ── Export ────────────────────────────────────────────────────────────────────
export {
  Download, // Export CSV
  FileDown, // Export PDF / file download
} from 'lucide-react';

// ── App shell ─────────────────────────────────────────────────────────────────
export {
  Menu,   // Mobile nav open
  X,      // Close / dismiss
  Sun,    // Switch to light mode
  Moon,   // Switch to dark mode
  LogOut, // Sign out
} from 'lucide-react';

// ── Misc ──────────────────────────────────────────────────────────────────────
export {
  Activity, // Handicap override / admin activity
  Palette,  // Component preview / design
} from 'lucide-react';
