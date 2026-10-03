import { ArrowLeft, ShieldCheck, Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import type { ClubEvent, EventTicket } from '../../lib/api-client';
import { apiGetEvent, apiRequestEventTicket } from '../../lib/api-client';

import {
  formatEventDate,
  formatEventMoney,
  getEventError,
  getTicketStatusLabel,
} from './event-utils';
import './event.css';

export function EventBookingPage() {
  const { eventId } = useParams();
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [ticket, setTicket] = useState<EventTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (eventId === undefined) return;
    void (async () => {
      try {
        const response = await apiGetEvent(eventId);
        setEvent(response.event);
        setTicket(response.ticket);
      } catch (loadError) {
        setError(getEventError(loadError));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [eventId]);

  async function handleRequest() {
    if (eventId === undefined) return;
    setIsRequesting(true);
    setError(null);
    try {
      const response = await apiRequestEventTicket(eventId);
      setTicket(response.ticket);
      setEvent((current) =>
        current === null
          ? current
          : { ...current, remainingTicketCount: current.remainingTicketCount - 1 },
      );
    } catch (requestError) {
      setError(getEventError(requestError));
    } finally {
      setIsRequesting(false);
    }
  }

  return (
    <div className="event-page event-page--narrow">
      <Link to={eventId === undefined ? '/events' : `/events/${eventId}`} className="event-back">
        <ArrowLeft size={16} /> Back to event
      </Link>
      {isLoading && <p className="event-loading">Loading booking…</p>}
      {error !== null && (
        <p className="event-inline-error" role="alert">
          {error}
        </p>
      )}
      {event !== null && (
        <section className="event-panel event-booking">
          <span className="event-icon" aria-hidden="true">
            <Ticket size={22} />
          </span>
          <div>
            <p className="event-eyebrow">Ticket request</p>
            <h1>{event.title}</h1>
            <p className="event-muted">{formatEventDate(event.startsAt)}</p>
          </div>
          <dl className="event-definition-list">
            <div>
              <dt>Member price</dt>
              <dd>{formatEventMoney(event.memberPriceCents, event.currency)}</dd>
            </div>
            <div>
              <dt>Nonmember price</dt>
              <dd>{formatEventMoney(event.nonMemberPriceCents, event.currency)}</dd>
            </div>
            <div>
              <dt>Seats remaining</dt>
              <dd>{event.remainingTicketCount}</dd>
            </div>
          </dl>
          <p className="event-notice">
            <ShieldCheck size={18} aria-hidden="true" />
            Your active membership is verified on the server. The displayed rates are not selected
            by the browser.
          </p>
          {ticket === null ? (
            <>
              <button
                type="button"
                className="event-button event-button--primary event-button--wide"
                onClick={() => void handleRequest()}
                disabled={isRequesting || event.remainingTicketCount === 0}
              >
                {isRequesting ? 'Requesting…' : 'Request ticket'}
              </button>
              <p className="event-muted">
                Paid tickets remain pending payment. This flow does not collect or confirm payment.
              </p>
            </>
          ) : (
            <div className="event-success" role="status">
              <h2>Ticket {getTicketStatusLabel(ticket.status)}</h2>
              <p>
                Applied price: {formatEventMoney(ticket.priceCents, ticket.currency)}
                {ticket.memberPriceApplied
                  ? ' at the active-member rate.'
                  : ' at the standard rate.'}
              </p>
              {ticket.status === 'pending_payment' && (
                <p>
                  No payment has been collected. Check-in stays unavailable until payment is
                  verified.
                </p>
              )}
              <Link to={`/events/${event._id}`} className="event-button event-button--secondary">
                View ticket
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
