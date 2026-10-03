import { AlertCircle, CalendarDays, MapPin, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { type ClubEvent, apiListEvents, apiPublishEvent } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';

import { formatEventDate, formatEventMoney, getEventError } from './event-utils';
import './event.css';

function EventCard({
  event,
  canManage,
  onPublished,
}: {
  event: ClubEvent;
  canManage: boolean;
  onPublished: (event: ClubEvent) => void;
}) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePublish() {
    setIsPublishing(true);
    setError(null);
    try {
      const response = await apiPublishEvent(event._id);
      onPublished(response.event);
    } catch (publishError) {
      setError(getEventError(publishError));
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <article className="event-card">
      <div className="event-card-heading">
        <span className="event-icon" aria-hidden="true">
          <CalendarDays size={20} />
        </span>
        <span className={event.isPublished ? 'event-badge event-badge--published' : 'event-badge'}>
          {event.isPublished ? 'Published' : 'Draft'}
        </span>
      </div>
      <div>
        <h2>
          <Link to={`/events/${event._id}`}>{event.title}</Link>
        </h2>
        <p className="event-muted">{formatEventDate(event.startsAt)}</p>
        {event.location !== undefined && (
          <p className="event-inline">
            <MapPin size={15} aria-hidden="true" /> {event.location}
          </p>
        )}
      </div>
      <div className="event-card-stats">
        <span>
          <strong>{event.remainingTicketCount}</strong> seats left
        </span>
        <span>
          Members: <strong>{formatEventMoney(event.memberPriceCents, event.currency)}</strong>
        </span>
        <span>
          Others: <strong>{formatEventMoney(event.nonMemberPriceCents, event.currency)}</strong>
        </span>
      </div>
      <div className="event-actions">
        <Link to={`/events/${event._id}`} className="event-button event-button--secondary">
          View details
        </Link>
        {canManage && !event.isPublished && (
          <button
            type="button"
            className="event-button event-button--primary"
            onClick={() => void handlePublish()}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing…' : 'Publish'}
          </button>
        )}
      </div>
      {error !== null && (
        <p className="event-inline-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}

export function EventListPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'officer' || user?.role === 'admin';
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiListEvents(canManage);
      setEvents(response.events);
    } catch (loadError) {
      setError(getEventError(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  function updatePublished(updatedEvent: ClubEvent) {
    setEvents((current) =>
      current.map((event) => (event._id === updatedEvent._id ? updatedEvent : event)),
    );
  }

  return (
    <div className="event-page">
      <header className="event-heading">
        <div>
          <h1>Events</h1>
          <p>Browse upcoming club events and request your ticket.</p>
        </div>
        {canManage && (
          <Link to="/events/new" className="event-button event-button--primary">
            <Plus size={17} aria-hidden="true" /> Create event
          </Link>
        )}
      </header>
      {isLoading && <p className="event-loading">Loading events…</p>}
      {!isLoading && error !== null && (
        <div className="event-state" role="alert">
          <AlertCircle size={28} aria-hidden="true" />
          <p>{error}</p>
          <button
            className="event-button event-button--secondary"
            onClick={() => void loadEvents()}
          >
            Try again
          </button>
        </div>
      )}
      {!isLoading && error === null && events.length === 0 && (
        <div className="event-state">
          <CalendarDays size={36} aria-hidden="true" />
          <h2>No upcoming events</h2>
          <p>{canManage ? 'Create an event to get started.' : 'Check back for new events.'}</p>
        </div>
      )}
      {!isLoading && events.length > 0 && (
        <div className="event-grid">
          {events.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              canManage={canManage}
              onPublished={updatePublished}
            />
          ))}
        </div>
      )}
    </div>
  );
}
