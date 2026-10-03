import { ArrowLeft, CalendarPlus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiCreateEvent, type CreateEventInput } from '../../lib/api-client';

import { getEventError } from './event-utils';
import './event.css';

function toIsoDate(value: string): string {
  return new Date(value).toISOString();
}

function toCents(value: string): number {
  return Math.round(Number(value) * 100);
}

function getFormString(form: FormData, name: string, fallback = ''): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : fallback;
}

export function EventCreatePage() {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setIsSaving(true);
    setError(null);
    const form = new FormData(submitEvent.currentTarget);
    const location = getFormString(form, 'location').trim();
    const deadline = getFormString(form, 'registrationDeadline');
    const input: CreateEventInput = {
      title: getFormString(form, 'title'),
      description: getFormString(form, 'description'),
      ...(location.length === 0 ? {} : { location }),
      startsAt: toIsoDate(getFormString(form, 'startsAt')),
      endsAt: toIsoDate(getFormString(form, 'endsAt')),
      ticketCapacity: Number(form.get('ticketCapacity')),
      ...(deadline.length === 0 ? {} : { registrationDeadline: toIsoDate(deadline) }),
      memberPriceCents: toCents(getFormString(form, 'memberPrice', '0')),
      nonMemberPriceCents: toCents(getFormString(form, 'nonMemberPrice', '0')),
      currency: getFormString(form, 'currency', 'INR').toUpperCase(),
      isPublished: form.get('isPublished') === 'on',
    };

    if (new Date(input.endsAt) <= new Date(input.startsAt)) {
      setError('Event end date must be after the start date.');
      setIsSaving(false);
      return;
    }
    if (input.registrationDeadline && new Date(input.registrationDeadline) > new Date(input.startsAt)) {
      setError('Request deadline must be before or equal to the event start date.');
      setIsSaving(false);
      return;
    }

    try {
      const response = await apiCreateEvent(input);
      navigate(`/events/${response.event._id}`);
    } catch (saveError) {
      setError(getEventError(saveError));
      setIsSaving(false);
    }
  }

  return (
    <div className="event-page event-page--narrow">
      <Link to="/events" className="event-back">
        <ArrowLeft size={16} /> Back to events
      </Link>
      <header className="event-heading">
        <div>
          <h1>Create event</h1>
          <p>Set the schedule, capacity, and both ticket rates.</p>
        </div>
      </header>
      <form className="event-panel event-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="event-form-icon" aria-hidden="true">
          <CalendarPlus size={22} />
        </div>
        <label>
          Event title
          <input name="title" required maxLength={200} />
        </label>
        <label>
          Description
          <textarea name="description" rows={5} maxLength={5000} />
        </label>
        <label>
          Location
          <input name="location" maxLength={200} />
        </label>
        <div className="event-form-grid">
          <label>
            Starts
            <input name="startsAt" type="datetime-local" required />
          </label>
          <label>
            Ends
            <input name="endsAt" type="datetime-local" required />
          </label>
        </div>
        <div className="event-form-grid">
          <label>
            Capacity
            <input name="ticketCapacity" type="number" min="1" step="1" required />
          </label>
          <label>
            Request deadline
            <input name="registrationDeadline" type="datetime-local" />
          </label>
        </div>
        <div className="event-form-grid event-form-grid--prices">
          <label>
            Member price
            <input name="memberPrice" type="number" min="0" step="0.01" required />
          </label>
          <label>
            Nonmember price
            <input name="nonMemberPrice" type="number" min="0" step="0.01" required />
          </label>
          <label>
            Currency
            <input name="currency" defaultValue="INR" minLength={3} maxLength={3} required />
          </label>
        </div>
        <label className="event-checkbox">
          <input name="isPublished" type="checkbox" />
          Publish immediately
        </label>
        {error !== null && (
          <p className="event-inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="event-button event-button--primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Create event'}
        </button>
      </form>
    </div>
  );
}
