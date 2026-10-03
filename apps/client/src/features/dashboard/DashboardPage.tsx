import { BarChart3, CalendarDays, ClipboardList, CreditCard, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { type ApiError, type DashboardSummary, apiGetDashboardSummary } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';
import './dashboard.css';

const EMPTY_SUMMARY: DashboardSummary = {
  activeMembers: 0,
  upcomingEvents: 0,
  openTasks: 0,
  pendingDues: 0,
};

/** Displays live club counts from membership, event, and volunteer-task records. */
export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const response = await apiGetDashboardSummary();
        if (!cancelled) setSummary(response.summary);
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as ApiError).message ?? 'Unable to load the club overview.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = [
    { label: 'Active members', value: summary.activeMembers, icon: <Users size={24} /> },
    { label: 'Upcoming events', value: summary.upcomingEvents, icon: <CalendarDays size={24} /> },
    { label: 'Open tasks', value: summary.openTasks, icon: <ClipboardList size={24} /> },
    { label: 'Pending dues', value: summary.pendingDues, icon: <CreditCard size={24} /> },
  ];

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

      <div className="dashboard-stats-grid" aria-busy={isLoading} aria-live="polite">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-card-icon" aria-hidden="true">
              {stat.icon}
            </div>
            <div className="stat-card-body">
              <span className="stat-card-value">{stat.value.toLocaleString()}</span>
              <span className="stat-card-label">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-empty-state">
        <div className="empty-state-icon" aria-hidden="true">
          <BarChart3 size={40} />
        </div>
        <h2 className="empty-state-title">
          {error === null ? 'Live club overview' : 'Overview temporarily unavailable'}
        </h2>
        <p className="empty-state-body">
          {error ??
            (isLoading
              ? 'Loading current membership, event, and volunteer-task totals.'
              : 'These figures come directly from current club records and update whenever the dashboard is opened.')}
        </p>
        <Link to="/membership" className="dashboard-action">
          View my membership
        </Link>
      </div>
    </div>
  );
}
