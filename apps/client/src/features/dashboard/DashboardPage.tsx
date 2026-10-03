import { CalendarDays, ClipboardList, CreditCard, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { type ApiError, type DashboardSummary, type Announcement, apiGetDashboardSummary, apiListAnnouncements } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';
import { Megaphone } from 'lucide-react';
import './dashboard.css';

const EMPTY_SUMMARY: DashboardSummary = {
  activeMembers: 0,
  upcomingEvents: 0,
  openTasks: 0,
  pendingDues: 0,
};

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const [summaryRes, annRes] = await Promise.all([
          apiGetDashboardSummary(),
          apiListAnnouncements()
        ]);
        if (!cancelled) {
          setSummary(summaryRes.summary);
          setAnnouncements(annRes.announcements);
        }
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

      {user?.role !== 'member' && (
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
      )}

      <div className="dashboard-content-section" style={{ marginTop: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-main)' }}>
          <Megaphone size={20} /> Latest Announcements
        </h2>
        {isLoading ? (
          <p>Loading announcements...</p>
        ) : announcements.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {announcements.slice(0, 3).map((ann) => (
              <div key={ann._id} style={{ padding: '1.25rem', backgroundColor: 'var(--surface-color)', borderRadius: '0.5rem', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>{ann.title}</h3>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>{ann.body}</p>
                <small style={{ display: 'block', marginTop: '0.5rem', color: 'var(--text-muted)' }}>By {ann.authorName} • {new Date(ann.createdAt).toLocaleDateString()}</small>
              </div>
            ))}
            <Link to="/announcements" style={{ alignSelf: 'flex-start', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 600 }}>
              View all announcements &rarr;
            </Link>
          </div>
        ) : (
          <div className="dashboard-empty-state">
            <div className="empty-state-icon" aria-hidden="true">
              <Megaphone size={40} />
            </div>
            <h2 className="empty-state-title">No announcements yet</h2>
            <p className="empty-state-body">
              {user?.role !== 'member' 
                ? 'Create an announcement to share news with the club!'
                : 'Check back later for club news and updates.'}
            </p>
          </div>
        )}
      </div>

      {user?.role === 'member' && (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <Link to="/membership" className="dashboard-action">
            View my membership
          </Link>
        </div>
      )}
    </div>
  );
}
