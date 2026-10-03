import { AlertCircle, HelpCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ApiError, SupportTicket } from '../../lib/api-client';
import { apiListAllSupportTickets, apiUpdateSupportTicketStatus } from '../../lib/api-client';

import './support.css';

export function ManageTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiListAllSupportTickets();
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

  async function handleStatusChange(ticketId: string, newStatus: 'open' | 'in_progress' | 'resolved') {
    setUpdatingId(ticketId);
    try {
      const res = await apiUpdateSupportTicketStatus(ticketId, newStatus);
      setTickets(tickets.map(t => t._id === ticketId ? res.ticket : t));
    } catch (err) {
      alert('Failed to update ticket status');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="support-page">
      <div className="support-heading-row">
        <div>
          <h1 className="support-title">Manage Support Tickets</h1>
          <p className="support-subtitle">Resolve member issues and answer questions.</p>
        </div>
      </div>

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
          <h2 className="ms-empty-title">No support tickets</h2>
          <p className="ms-empty-desc">Members haven't raised any issues yet.</p>
        </div>
      )}

      {!isLoading && !error && tickets.length > 0 && (
        <div className="support-list">
          {tickets.map(ticket => (
            <div key={ticket._id} className="support-card">
              <div className="support-card-header">
                <div>
                  <h3 className="support-card-title">{ticket.subject}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--slate-500)', margin: '0.25rem 0' }}>
                    From: <strong>{ticket.userName}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select 
                    className="ms-input"
                    style={{ padding: '0.25rem 0.5rem', height: 'auto', minHeight: '32px' }}
                    value={ticket.status}
                    disabled={updatingId === ticket._id}
                    onChange={(e) => void handleStatusChange(ticket._id, e.target.value as any)}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
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
