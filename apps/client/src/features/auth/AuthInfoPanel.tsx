import { CalendarDays, CreditCard, Megaphone, Users } from 'lucide-react';

export function AuthInfoPanel() {
  return (
    <div className="auth-info-panel">
      <h2 className="auth-info-title">Student Club OS</h2>
      <p className="auth-info-desc">
        The all-in-one platform helping student clubs run memberships, events, dues, and announcements seamlessly.
      </p>
      
      <div className="auth-info-features">
        <div className="auth-info-feature">
          <Users size={20} className="auth-info-feature-icon" aria-hidden="true" />
          <span className="auth-info-feature-text">Manage memberships and track active members</span>
        </div>
        <div className="auth-info-feature">
          <CalendarDays size={20} className="auth-info-feature-icon" aria-hidden="true" />
          <span className="auth-info-feature-text">RSVP for upcoming events and workshops</span>
        </div>
        <div className="auth-info-feature">
          <CreditCard size={20} className="auth-info-feature-icon" aria-hidden="true" />
          <span className="auth-info-feature-text">Pay dues and purchase club merchandise</span>
        </div>
        <div className="auth-info-feature">
          <Megaphone size={20} className="auth-info-feature-icon" aria-hidden="true" />
          <span className="auth-info-feature-text">Stay updated with the latest club announcements</span>
        </div>
      </div>
    </div>
  );
}
