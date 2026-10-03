import { ArrowLeft, Check, ClipboardCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  type ClubEvent,
  type EventTicket,
  apiCheckInEventTicket,
  apiGetEvent,
  apiListEventTickets,
} from '../../lib/api-client';

import {
  formatEventDate,
  formatEventMoney,
  getEventError,
  getTicketStatusLabel,
} from './event-utils';
import './event.css';

function CheckInRow({
  eventId,
  ticket,
  onCheckedIn,
}: {
  eventId: string;
  ticket: EventTicket;
  onCheckedIn: (ticket: EventTicket) => void;
}) {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canCheckIn = ticket.status === 'confirmed' && ticket.checkedInAt === undefined;

  async function handleCheckIn() {
    setIsCheckingIn(true);
    setError(null);
    try {
      const response = await apiCheckInEventTicket(eventId, ticket._id);
      onCheckedIn(response.ticket);
    } catch (checkInError) {
      setError(getEventError(checkInError));
    } finally {
      setIsCheckingIn(false);
    }
  }

  return (
    <li className="event-ticket-row">
      <div>
        <strong>{ticket.attendeeName}</strong>
        <span>{ticket.attendeeEmail}</span>
      </div>
      <div>
        <span className="event-capitalize">{getTicketStatusLabel(ticket.status)}</span>
        <span>{formatEventMoney(ticket.priceCents, ticket.currency)}</span>
      </div>
      <div className="event-ticket-action">
        {ticket.checkedInAt === undefined ? (
          <button
            type="button"
            className="event-button event-button--primary"
            onClick={() => void handleCheckIn()}
            disabled={!canCheckIn || isCheckingIn}
          >
            <Check size={16} /> {isCheckingIn ? 'Checking in…' : 'Check in'}
          </button>
        ) : (
          <span className="event-checked-in">
            <Check size={16} /> {formatEventDate(ticket.checkedInAt)}
          </span>
        )}
        {ticket.status === 'pending_payment' && (
          <span className="event-muted">Payment not verified</span>
        )}
        {error !== null && (
          <span className="event-inline-error" role="alert">
            {error}
          </span>
        )}
      </div>
    </li>
  );
}

export function EventCheckInPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    if (eventId === undefined) return;
    setIsLoading(true);
    setError(null);
    try {
      const [eventResponse, ticketResponse] = await Promise.all([
        apiGetEvent(eventId),
        apiListEventTickets(eventId),
      ]);
      setEvent(eventResponse.event);
      setTickets(ticketResponse.tickets);
    } catch (loadError) {
      setError(getEventError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  function updateTicket(updatedTicket: EventTicket) {
    setTickets((current) =>
      current.map((ticket) => (ticket._id === updatedTicket._id ? updatedTicket : ticket)),
    );
  }

  return (
    <div className="event-page">
      <Link to={eventId === undefined ? '/events' : `/events/${eventId}`} className="event-back">
        <ArrowLeft size={16} /> Back to event
      </Link>
      <header className="event-heading">
        <div>
          <h1>Ticket check-in</h1>
          <p>{event?.title ?? 'Event attendees'}</p>
        </div>
      </header>
      {isLoading && <p className="event-loading">Loading tickets…</p>}
      {!isLoading && error !== null && (
        <div className="event-state" role="alert">
          <p>{error}</p>
        </div>
      )}
      {!isLoading && error === null && tickets.length === 0 && (
        <div className="event-state">
          <ClipboardCheck size={36} aria-hidden="true" />
          <h2>No ticket requests</h2>
          <p>Requested tickets will appear here.</p>
        </div>
      )}
      {tickets.length > 0 && (
        <ul className="event-ticket-list">
          {tickets.map((ticket) => (
            <CheckInRow
              key={ticket._id}
              eventId={ticket.eventId}
              ticket={ticket}
              onCheckedIn={updateTicket}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
