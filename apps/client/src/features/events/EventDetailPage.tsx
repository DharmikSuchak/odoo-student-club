import { ArrowLeft, CalendarDays, MapPin, TicketCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ClubEvent, EventTicket } from '../../lib/api-client';
import { apiGetEvent } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';

import {
  formatEventDate,
  formatEventMoney,
  getEventError,
  getTicketStatusLabel,
} from './event-utils';
import './event.css';

function TicketSummary({ ticket }: { ticket: EventTicket }) {
  return (
    <section className="event-panel event-ticket-summary">
      <div>
        <p className="event-eyebrow">Your ticket</p>
        <h2 className="event-capitalize">{getTicketStatusLabel(ticket.status)}</h2>
      </div>
      <dl className="event-definition-list">
        <div>
          <dt>Price</dt>
          <dd>{formatEventMoney(ticket.priceCents, ticket.currency)}</dd>
        </div>
        <div>
          <dt>Rate</dt>
          <dd>{ticket.memberPriceApplied ? 'Active member' : 'Standard'}</dd>
        </div>
        <div>
          <dt>Check-in</dt>
          <dd>
            {ticket.checkedInAt === undefined
              ? 'Not checked in'
              : formatEventDate(ticket.checkedInAt)}
          </dd>
        </div>
      </dl>
      {ticket.status === 'pending_payment' && (
        <p className="event-notice">
          Ticket requested. No payment has been collected, and this ticket cannot be checked in
          until a verified payment mechanism confirms it.
        </p>
      )}
    </section>
  );
}

function EventInformation({ event }: { event: ClubEvent }) {
  return (
    <section className="event-panel">
      <div className="event-detail-title">
        <span className="event-icon" aria-hidden="true">
          <CalendarDays size={22} />
        </span>
        <div>
          <span
            className={event.isPublished ? 'event-badge event-badge--published' : 'event-badge'}
          >
            {event.isPublished ? 'Published' : 'Draft'}
          </span>
          <h1>{event.title}</h1>
        </div>
      </div>
      <div className="event-detail-meta">
        <p>
          <CalendarDays size={17} aria-hidden="true" /> {formatEventDate(event.startsAt)} to{' '}
          {formatEventDate(event.endsAt)}
        </p>
        {event.location !== undefined && (
          <p>
            <MapPin size={17} aria-hidden="true" /> {event.location}
          </p>
        )}
      </div>
      {event.description.length > 0 && <p className="event-description">{event.description}</p>}
      <dl className="event-definition-list event-definition-list--three">
        <div>
          <dt>Seats available</dt>
          <dd>
            {event.remainingTicketCount} of {event.ticketCapacity}
          </dd>
        </div>
        <div>
          <dt>Member price</dt>
          <dd>{formatEventMoney(event.memberPriceCents, event.currency)}</dd>
        </div>
        <div>
          <dt>Nonmember price</dt>
          <dd>{formatEventMoney(event.nonMemberPriceCents, event.currency)}</dd>
        </div>
      </dl>
      {event.registrationDeadline !== undefined && (
        <p className="event-muted">Requests close {formatEventDate(event.registrationDeadline)}.</p>
      )}
    </section>
  );
}

export function EventDetailPage() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEvent = useCallback(async () => {
    if (eventId === undefined) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGetEvent(eventId);
      setEvent(response.event);
      setTicket(response.ticket);
    } catch (loadError) {
      setError(getEventError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const canManage = user?.role === 'officer' || user?.role === 'admin';
  return (
    <div className="event-page">
      <Link to="/events" className="event-back">
        <ArrowLeft size={16} /> Back to events
      </Link>
      {isLoading && <p className="event-loading">Loading event…</p>}
      {!isLoading && error !== null && (
        <div className="event-state" role="alert">
          <p>{error}</p>
        </div>
      )}
      {event !== null && (
        <div className="event-detail-layout">
          <EventInformation event={event} />
          <aside className="event-detail-side">
            {ticket === null ? (
              <section className="event-panel">
                <p className="event-eyebrow">Tickets</p>
                <h2>{event.remainingTicketCount > 0 ? 'Reserve your place' : 'Sold out'}</h2>
                <p className="event-muted">
                  The server verifies active membership before selecting your price.
                </p>
                <Link
                  to={`/events/${event._id}/book`}
                  className="event-button event-button--primary event-button--wide"
                  aria-disabled={event.remainingTicketCount === 0}
                >
                  Request ticket
                </Link>
              </section>
            ) : (
              <TicketSummary ticket={ticket} />
            )}
            {canManage && (
              <Link
                to={`/events/${event._id}/check-in`}
                className="event-button event-button--secondary event-button--wide"
              >
                <TicketCheck size={17} /> Manage check-in
              </Link>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
