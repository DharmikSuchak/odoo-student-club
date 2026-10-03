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
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { Dialog } from '../../components/Dialog';
import { useAuth } from '../auth/AuthContext';
import './shell.css';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  minRole?: 'member' | 'officer' | 'treasurer' | 'admin';
  planned?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'My Membership', to: '/membership', icon: <CreditCard size={18} /> },
  {
    label: 'Members',
    to: '/members',
    icon: <Users size={18} />,
    minRole: 'officer',
    planned: true,
  },
  {
    label: 'Manage Memberships',
    to: '/manage/memberships',
    icon: <Receipt size={18} />,
    minRole: 'officer',
  },
  { label: 'Events', to: '/events', icon: <Calendar size={18} />, planned: true },
  { label: 'Announcements', to: '/announcements', icon: <Megaphone size={18} /> },
  { label: 'Merchandise', to: '/merchandise', icon: <ShoppingBag size={18} />, planned: true },
  { label: 'Volunteer Tasks', to: '/tasks', icon: <ClipboardList size={18} /> },
  { label: 'Submit Expense', to: '/expenses', icon: <Receipt size={18} />, minRole: 'officer' },
  {
    label: 'Expense Review',
    to: '/treasurer/expenses',
    icon: <Receipt size={18} />,
    minRole: 'treasurer',
  },
  {
    label: 'Treasurer Report',
    to: '/treasurer/report',
    icon: <CreditCard size={18} />,
    minRole: 'treasurer',
  },
];
const ROLE_ORDER = ['member', 'officer', 'treasurer', 'admin'] as const;

function NavigationItem({
  item,
  onNavClick,
}: {
  item: NavItem;
  onNavClick?: (() => void) | undefined;
}) {
  const content = (
    <>
      <span className="sidebar-nav-icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="sidebar-nav-label">{item.label}</span>
    </>
  );
  return (
    <li>
      {item.planned ? (
        <span className="sidebar-nav-item sidebar-nav-item--planned" aria-disabled="true">
          {content}
          <span className="sidebar-planned-tag">Soon</span>
        </span>
      ) : (
        <NavLink
          to={item.to}
          className={({ isActive }) =>
            `sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`
          }
          onClick={onNavClick}
          end={item.to !== '/announcements' && item.to !== '/tasks'}
        >
          {content}
        </NavLink>
      )}
    </li>
  );
}

function SidebarUser() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function handleLogout() {
    setIsSigningOut(true);
    setError(null);
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to sign out. Try again.');
    } finally {
      setIsSigningOut(false);
    }
  }
  if (!user) return null;
  return (
    <div className="sidebar-user-footer">
      {error && (
        <p className="sidebar-error" role="alert">
          {error}
        </p>
      )}
      <div className="sidebar-user-card">
        <span className="sidebar-user-avatar" aria-hidden="true">
          {user.displayName.charAt(0).toUpperCase()}
        </span>
        <div className="sidebar-user-info">
          <span className="sidebar-user-name" title={user.displayName}>
            {user.displayName}
          </span>
          <span className={`sidebar-user-role sidebar-user-role--${user.role}`}>{user.role}</span>
        </div>
        <button
          type="button"
          className="sidebar-logout-btn"
          onClick={() => void handleLogout()}
          disabled={isSigningOut}
          aria-busy={isSigningOut}
          aria-label={isSigningOut ? 'Signing out' : 'Sign out'}
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}

function SidebarNav({ onNavClick }: { onNavClick?: (() => void) | undefined }) {
  const { user } = useAuth();
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      !item.minRole || (user && ROLE_ORDER.indexOf(user.role) >= ROLE_ORDER.indexOf(item.minRole)),
  );
  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      <p className="sidebar-section-label">Your club</p>
      <ul className="sidebar-menu">
        {visibleItems.map((item) => (
          <NavigationItem key={item.to} item={item} onNavClick={onNavClick} />
        ))}
      </ul>
      <SidebarUser />
    </nav>
  );
}

/** Provides the shared header, role-aware navigation and scrollable page content.
 * @param props Page content to render inside the authenticated shell.
 * @returns The desktop shell with an accessible mobile navigation dialog.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 769px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setDrawerOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  return (
    <div className="shell">
      <a href="#main-content" className="shell-skip-link">
        Skip to content
      </a>
      <header className="shell-header">
        <button
          type="button"
          className="shell-hamburger"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-haspopup="dialog"
        >
          <Menu size={20} />
        </button>
        <div className="shell-header-title">
          <span className="shell-header-logo" aria-hidden="true">
            SC
          </span>
          <span className="shell-header-brand">Student Club</span>
        </div>
        <span className="shell-header-spacer" />
        <span className="shell-header-user" title={user?.displayName}>
          {user?.displayName}
        </span>
      </header>
      <aside className="shell-sidebar" aria-label="Sidebar">
        <SidebarNav />
      </aside>
      {drawerOpen && (
        <Dialog
          titleId="mobile-navigation-title"
          onClose={() => setDrawerOpen(false)}
          className="shell-drawer"
        >
          <div className="shell-drawer-content">
            <div className="shell-drawer-heading">
              <h2 id="mobile-navigation-title">Student Club</h2>
              <button
                type="button"
                className="shell-drawer-close"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>
            <SidebarNav onNavClick={() => setDrawerOpen(false)} />
          </div>
        </Dialog>
      )}
      <main className="shell-content" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
