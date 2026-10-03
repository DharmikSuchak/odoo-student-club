/**
 * DashboardPage — /dashboard
 *
 * Currently an empty placeholder page that confirms the authenticated
 * layout is working. Stats and data will be added in Phase 2+.
 */
import { BarChart3, CalendarDays, ClipboardList, CreditCard, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import './dashboard.css';

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="dashboard">
      <div className="dashboard-heading-row">
        <div>
          <h1 className="dashboard-title">Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome back, <strong>{user?.displayName ?? 'member'}</strong>! Here&apos;s what&apos;s
            happening in your club.
          </p>
        </div>
      </div>

      <div className="dashboard-stats-grid">
        {PLACEHOLDER_STATS.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-card-icon" aria-hidden="true">
              {stat.icon}
            </div>
            <div className="stat-card-body">
              <span className="stat-card-value" aria-label="Not available yet">
                —
              </span>
              <span className="stat-card-label">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-empty-state">
        <div className="empty-state-icon" aria-hidden="true">
          <BarChart3 size={40} />
        </div>
        <h2 className="empty-state-title">Your club overview is on its way</h2>
        <p className="empty-state-body">
          Club-wide statistics are not available yet. You can view your membership status and dues
          from My Membership.
        </p>
        <Link to="/membership" className="dashboard-action">
          View my membership
        </Link>
      </div>
    </div>
  );
}

const PLACEHOLDER_STATS = [
  { label: 'Active members', icon: <Users size={24} /> },
  { label: 'Upcoming events', icon: <CalendarDays size={24} /> },
  { label: 'Open tasks', icon: <ClipboardList size={24} /> },
  { label: 'Pending dues', icon: <CreditCard size={24} /> },
];
