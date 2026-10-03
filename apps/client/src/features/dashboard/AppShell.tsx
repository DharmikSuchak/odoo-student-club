/**
 * AppShell — authenticated layout wrapper.
 *
 * Implements design-system.md §5 (Layout) and §6 (Sidebar):
 * - 240px fixed sidebar on desktop
 * - Slide-in drawer on mobile (≤ 768px)
 * - Sticky header z-50
 * - Scrollable main content area
 * - Role badge in user card
 */
import {
  LayoutDashboard,
  Users,
  Calendar,
  Megaphone,
  ShoppingBag,
  ClipboardList,
  Receipt,
  CreditCard,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import './shell.css';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  minRole?: 'member' | 'officer' | 'treasurer' | 'admin';
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'My Membership', to: '/membership', icon: <CreditCard size={18} /> },
  { label: 'Members', to: '/members', icon: <Users size={18} />, minRole: 'officer' },
  { label: 'Manage Memberships', to: '/manage/memberships', icon: <Receipt size={18} />, minRole: 'officer' },
  { label: 'Events', to: '/events', icon: <Calendar size={18} /> },
  { label: 'Announcements', to: '/announcements', icon: <Megaphone size={18} /> },
  { label: 'Merchandise', to: '/merchandise', icon: <ShoppingBag size={18} /> },
  { label: 'Volunteer Tasks', to: '/tasks', icon: <ClipboardList size={18} /> },
  { label: 'Expenses', to: '/expenses', icon: <Receipt size={18} />, minRole: 'treasurer' },
];

const ROLE_ORDER = ['member', 'officer', 'treasurer', 'admin'] as const;

function hasMinRole(
  userRole: (typeof ROLE_ORDER)[number],
  minRole: (typeof ROLE_ORDER)[number],
): boolean {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(minRole);
}

const ROLE_LABELS: Record<string, string> = {
  member: 'Member',
  officer: 'Officer',
  treasurer: 'Treasurer',
  admin: 'Admin',
};

interface SidebarNavProps {
  onNavClick?: () => void;
}

function SidebarNav({ onNavClick }: SidebarNavProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.minRole === undefined) return true;
    if (user === null) return false;
    return hasMinRole(user.role, item.minRole);
  });

  async function handleLogout() {
    await logout();
    void navigate('/login');
  }

  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="sidebar-logo" aria-hidden="true">
          SC
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">Student Club</span>
          <span className="sidebar-brand-tag">Platform</span>
        </div>
      </div>

      <div className="sidebar-section-label">Navigation</div>

      <ul className="sidebar-menu">
        {visibleItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
              }
              onClick={onNavClick}
              end={item.to === '/dashboard'}
            >
              <span className="sidebar-nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
              <ChevronRight className="sidebar-nav-arrow" size={14} aria-hidden="true" />
            </NavLink>
          </li>
        ))}
      </ul>

      {/* User card at bottom */}
      {user !== null && (
        <div className="sidebar-user-card">
          <div className="sidebar-user-avatar" aria-hidden="true">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user.displayName}</span>
            <span className={`sidebar-user-role sidebar-user-role--${user.role}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={() => void handleLogout()}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      )}
    </nav>
  );
}

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Main authenticated layout shell.
 *
 * @param children  Page content to render in the scrollable content area.
 */
export function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Close drawer on Escape key (design-system.md §5 Mobile)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && drawerOpen) {
        closeDrawer();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen, closeDrawer]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  return (
    <div className="shell">
      {/* ── Desktop sidebar (always visible ≥ 769px) ─────────── */}
      <aside className="shell-sidebar" aria-label="Sidebar">
        <SidebarNav />
      </aside>

      {/* ── Mobile drawer ─────────────────────────────────────── */}
      {drawerOpen && (
        <div className="shell-drawer-backdrop" onClick={closeDrawer} aria-hidden="true" />
      )}
      <aside
        className={`shell-drawer ${drawerOpen ? 'shell-drawer--open' : ''}`}
        aria-label="Mobile navigation"
      >
        <SidebarNav onNavClick={closeDrawer} />
      </aside>

      {/* ── Right panel ───────────────────────────────────────── */}
      <div className="shell-right">
        {/* Sticky header */}
        <header className="shell-header" role="banner">
          {/* Hamburger — mobile only */}
          <button
            type="button"
            className="shell-hamburger"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
          >
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="shell-header-title">
            <span className="shell-header-logo" aria-hidden="true">
              SC
            </span>
            <span className="shell-header-brand">Student Club</span>
          </div>

          <div className="shell-header-spacer" />
        </header>

        {/* Scrollable content */}
        <main className="shell-content" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
