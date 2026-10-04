import { Users, CalendarDays, BarChart3, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';

import './landing.css';

export function LandingPage() {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-content">
          <div className="landing-brand">
            <div className="landing-logo" aria-hidden="true">
              <span>SC</span>
            </div>
            <span className="landing-brand-name">Student Club OS</span>
          </div>
          <div className="landing-nav-links">
            <Link to="/login" className="ms-btn ms-btn--ghost">
              Sign In
            </Link>
            <Link to="/register" className="ms-btn ms-btn--primary">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      <main className="landing-main">
        <section className="landing-hero">
          <h1 className="landing-title">Run your whole club in one place.</h1>
          <p className="landing-subtitle">
            Memberships, events, dues, announcements, and volunteer work, together in one platform built for student organizations.
          </p>
          <div className="landing-cta-wrapper">
            <Link to="/register" className="ms-btn ms-btn--primary ms-btn--lg">
              Sign Up Now
            </Link>
          </div>
        </section>

        <section className="landing-features">
          <div className="landing-feature-card">
            <Users className="landing-feature-icon" size={24} aria-hidden="true" />
            <h3 className="landing-feature-title">Memberships and Dues</h3>
          </div>
          <div className="landing-feature-card">
            <CalendarDays className="landing-feature-icon" size={24} aria-hidden="true" />
            <h3 className="landing-feature-title">Events and Tickets</h3>
          </div>
          <div className="landing-feature-card">
            <BarChart3 className="landing-feature-icon" size={24} aria-hidden="true" />
            <h3 className="landing-feature-title">Treasurer Reports</h3>
          </div>
          <div className="landing-feature-card">
            <ClipboardList className="landing-feature-icon" size={24} aria-hidden="true" />
            <h3 className="landing-feature-title">Volunteer Coordination</h3>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} Student Club OS. All rights reserved.</p>
      </footer>
    </div>
  );
}
