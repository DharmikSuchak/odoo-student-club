/**
 * DashboardPage — /dashboard
 *
 * Currently an empty placeholder page that confirms the authenticated
 * layout is working. Stats and data will be added in Phase 2+.
 */
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
            Welcome back, <strong>{user?.displayName ?? 'member'}</strong>! Here's what's happening
            in your club.
          </p>
        </div>
      </div>

      {/* Placeholder stat cards */}
      <div className="dashboard-stats-grid">
        {PLACEHOLDER_STATS.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-card-icon" aria-hidden="true" style={{ background: stat.iconBg }}>
              {stat.icon}
            </div>
            <div className="stat-card-body">
              <span className="stat-card-value">—</span>
              <span className="stat-card-label">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      <div className="dashboard-empty-state">
        <div className="empty-state-icon" aria-hidden="true">
          📊
        </div>
        <h2 className="empty-state-title">No data yet</h2>
        <p className="empty-state-body">
          Dashboard statistics will appear here once your club starts recording memberships, events,
          and activity.
        </p>
        <span className="empty-state-tag">Phase 2 — coming soon</span>
      </div>
    </div>
  );
}

const PLACEHOLDER_STATS = [
  { label: 'Active members', icon: '👥', iconBg: 'rgba(14, 165, 233, 0.10)' },
  { label: 'Upcoming events', icon: '📅', iconBg: 'rgba(124, 58, 237, 0.10)' },
  { label: 'Open tasks', icon: '✅', iconBg: 'rgba(21, 128, 61, 0.10)' },
  { label: 'Pending dues', icon: '💰', iconBg: 'rgba(180, 83, 9, 0.10)' },
];
