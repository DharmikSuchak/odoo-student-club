import { AlertCircle, CalendarDays, ClipboardList, CreditCard, Users , Megaphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { type ApiError, type DashboardSummary, type Announcement, apiGetDashboardSummary, apiListAnnouncements } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';
import './dashboard.css';

const EMPTY_SUMMARY: DashboardSummary = {
  activeMembers: 0,
  upcomingEvents: 0,
  openTasks: 0,
  pendingDues: 0,
  tierBreakdown: [],
};

export function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    { label: 'Active members', value: summary.activeMembers, icon: <Users size={24} />, to: '/manage/memberships', color: 'var(--brand-500)', bg: 'var(--brand-50)' },
    { label: 'Upcoming events', value: summary.upcomingEvents, icon: <CalendarDays size={24} />, to: '/events', color: 'var(--emerald-600)', bg: 'var(--emerald-50)' },
    { label: 'Open tasks', value: summary.openTasks, icon: <ClipboardList size={24} />, to: '/tasks', color: 'var(--amber-600)', bg: 'var(--amber-50)' },
    { label: 'Pending dues', value: summary.pendingDues, icon: <CreditCard size={24} />, to: '/manage/memberships', color: 'var(--rose-600)', bg: 'var(--rose-50)' },
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

      {!isLoading && error !== null && (
        <div className="ms-alert ms-alert--error" role="alert" style={{ marginBottom: '1.5rem' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {user?.role !== 'member' && (
        <div className="dashboard-stats-grid" aria-busy={isLoading} aria-live="polite">
          {stats.map((stat) => (
            <Link to={stat.to} key={stat.label} className="stat-card" style={{ textDecoration: 'none' }}>
              <div className="stat-card-icon" aria-hidden="true" style={{ color: stat.color, backgroundColor: stat.bg, opacity: 1 }}>
                {stat.icon}
              </div>
              <div className="stat-card-body">
                <span className="stat-card-value">{stat.value.toLocaleString()}</span>
                <span className="stat-card-label">{stat.label}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="dashboard-content-layout">
        <div className="dashboard-content-section">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--slate-800)', fontSize: '1.25rem' }}>
            <Megaphone size={20} color="var(--brand-500)" /> Latest Announcements
          </h2>
          {isLoading ? (
            <p>Loading announcements...</p>
          ) : announcements.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {announcements.slice(0, 3).map((ann) => (
                <div key={ann._id} className="announcement-mini-card">
                  <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--slate-800)', fontSize: '1.05rem', fontWeight: 600 }}>{ann.title}</h3>
                  <p style={{ margin: 0, color: 'var(--slate-600)', fontSize: '0.9rem', lineHeight: 1.5 }}>{ann.body}</p>
                  <small style={{ display: 'block', marginTop: '0.75rem', color: 'var(--slate-400)', fontSize: '0.8rem' }}>By {ann.authorName} • {new Date(ann.createdAt).toLocaleDateString()}</small>
                </div>
              ))}
              <Link to="/announcements" style={{ alignSelf: 'flex-start', color: 'var(--brand-600)', textDecoration: 'none', fontWeight: 600, marginTop: '0.5rem' }}>
                View all announcements &rarr;
              </Link>
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <div className="empty-state-icon" aria-hidden="true" style={{ color: 'var(--slate-300)', filter: 'none' }}>
                <Megaphone size={48} />
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

        {user?.role !== 'member' && (
          <div className="dashboard-content-section dashboard-sidebar-section">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--slate-800)', fontSize: '1.25rem' }}>
              <ClipboardList size={20} color="var(--amber-500)" /> Quick Actions
            </h2>
            <div className="quick-actions-grid">
              {user?.role === 'admin' && (
                <Link to="/members" className="quick-action-btn">
                  <Users size={18} /> Manage Users
                </Link>
              )}
              {user?.role !== 'admin' && (
                <Link to="/tasks" className="quick-action-btn">
                  <ClipboardList size={18} /> Volunteer Tasks
                </Link>
              )}
              <Link to="/events" className="quick-action-btn">
                <CalendarDays size={18} /> Manage Events
              </Link>
              <Link to="/manage/support" className="quick-action-btn">
                <Users size={18} /> View Support Tickets
              </Link>
            </div>

            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2.5rem', marginBottom: '1.25rem', color: 'var(--slate-800)', fontSize: '1.25rem' }}>
              <Users size={20} color="var(--brand-500)" /> Tier Analytics
            </h2>
            {isLoading ? (
               <p>Loading analytics...</p>
            ) : summary.tierBreakdown && summary.tierBreakdown.length > 0 ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 {summary.tierBreakdown.map((tier, idx) => {
                   const maxCount = summary.activeMembers || 1;
                   const percentage = Math.round((tier.count / maxCount) * 100);
                   const colors = [
                     'var(--brand-500)',
                     'var(--emerald-500)',
                     'var(--amber-500)',
                     'var(--rose-500)',
                     'var(--purple-500)',
                   ];
                   const color = colors[idx % colors.length];
                   
                   return (
                     <div key={tier.tierName} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', color: 'var(--slate-700)', fontWeight: 600 }}>
                         <span>{tier.tierName}</span>
                         <span>{tier.count} <span style={{ color: 'var(--slate-400)', fontWeight: 400 }}>({percentage}%)</span></span>
                       </div>
                       <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--slate-100)', borderRadius: '4px', overflow: 'hidden' }}>
                         <div style={{ height: '100%', width: `${percentage}%`, backgroundColor: color, borderRadius: '4px', transition: 'width 0.5s ease-out' }} />
                       </div>
                     </div>
                   );
                 })}
               </div>
            ) : (
               <p style={{ color: 'var(--slate-500)', fontSize: '0.95rem' }}>No active memberships to display.</p>
            )}
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
