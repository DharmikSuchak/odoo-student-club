import { AlertCircle, Plus, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Dialog } from '../../components/Dialog';
import type { ApiError, SupportTicket } from '../../lib/api-client';
import { apiCreateSupportTicket, apiListMySupportTickets } from '../../lib/api-client';

import './support.css';

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: '', description: '' });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiListMySupportTickets();
        if (!cancelled) setTickets(res.tickets);
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setError(apiErr.message ?? 'Failed to load tickets.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiCreateSupportTicket(form.subject, form.description);
      setTickets([res.ticket, ...tickets]);
      setIsDialogOpen(false);
      setForm({ subject: '', description: '' });
    } catch (err) {
      const apiErr = err as ApiError;
      setSubmitError(apiErr.message ?? 'Failed to submit ticket.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="support-page">
      <div className="support-heading-row">
        <div>
          <h1 className="support-title">Help & Support</h1>
          <p className="support-subtitle">Raise issues or ask questions directly to the club team.</p>
        </div>
        <button className="ms-btn ms-btn--primary" onClick={() => setIsDialogOpen(true)}>
          <Plus size={18} style={{ marginRight: '0.5rem' }} />
          New Ticket
        </button>
      </div>

      {isDialogOpen && (
        <Dialog titleId="new-ticket-title" onClose={() => setIsDialogOpen(false)}>
          <div style={{ padding: '1.5rem', width: '500px', maxWidth: '100%' }}>
            <h2 id="new-ticket-title" style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 600 }}>Create Support Ticket</h2>
            <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {submitError && (
                <div className="ms-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={20} />
                  <p>{submitError}</p>
                </div>
              )}
              <div className="ms-form-group">
                <label className="ms-label" htmlFor="subject">Subject</label>
                <input
                  id="subject"
                  type="text"
                  required
                  className="ms-input"
                  placeholder="e.g. Cannot access event page"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
              <div className="ms-form-group">
                <label className="ms-label" htmlFor="description">Description</label>
                <textarea
                  id="description"
                  required
                  className="ms-input"
                  rows={5}
                  placeholder="Describe your issue in detail..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="ms-btn" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="ms-btn ms-btn--primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
      )}

      {isLoading && <p>Loading tickets...</p>}

      {!isLoading && error && (
        <div className="ms-error" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {!isLoading && !error && tickets.length === 0 && (
        <div className="ms-empty">
          <HelpCircle size={48} />
          <h2 className="ms-empty-title">No tickets yet</h2>
          <p className="ms-empty-desc">If you need help, feel free to open a new ticket!</p>
        </div>
      )}

      {!isLoading && !error && tickets.length > 0 && (
        <div className="support-list">
          {tickets.map(ticket => (
            <div key={ticket._id} className="support-card">
              <div className="support-card-header">
                <h3 className="support-card-title">{ticket.subject}</h3>
                <span className={`support-status support-status--${ticket.status}`}>
                  {ticket.status === 'open' && 'Open'}
                  {ticket.status === 'in_progress' && 'In Progress'}
                  {ticket.status === 'resolved' && 'Resolved'}
                </span>
              </div>
              <p className="support-card-desc">{ticket.description}</p>
              <div className="support-card-footer">
                <span>Submitted {new Date(ticket.createdAt).toLocaleDateString()}</span>
                {ticket.resolvedAt && <span>Resolved {new Date(ticket.resolvedAt).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
