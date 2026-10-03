import { AlertCircle, ArrowLeft, Megaphone, Pencil, Pin, Plus, Send } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  type Announcement,
  type ApiError,
  apiCreateAnnouncement,
  apiGetAnnouncement,
  apiListAnnouncements,
  apiUpdateAnnouncement,
} from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';

import './announcement.css';

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getErrorMessage(error: unknown): string {
  return (error as ApiError).message ?? 'Something went wrong. Please try again.';
}

function getLastViewedKey(userId: string): string {
  return `club-announcements-last-viewed:${userId}`;
}

function EmptyAnnouncements() {
  return (
    <div className="announcement-empty">
      <Megaphone size={40} aria-hidden="true" />
      <h2>No announcements yet</h2>
      <p>Club updates will appear here as soon as an organizer publishes one.</p>
    </div>
  );
}

function AnnouncementError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="announcement-error" role="alert">
      <AlertCircle size={26} aria-hidden="true" />
      <p>{message}</p>
      <button className="announcement-button announcement-button--secondary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function AnnouncementCard({
  announcement,
  isUnread,
}: {
  announcement: Announcement;
  isUnread: boolean;
}) {
  return (
    <article className={`announcement-card ${isUnread ? 'announcement-card--unread' : ''}`}>
      <Link to={`/announcements/${announcement._id}`} className="announcement-card-link">
        <div className="announcement-card-topline">
          <div className="announcement-badges">
            {announcement.isPinned && (
              <span className="announcement-badge announcement-badge--pinned">
                <Pin size={12} aria-hidden="true" /> Pinned
              </span>
            )}
            {isUnread && <span className="announcement-badge announcement-badge--new">New</span>}
          </div>
          <time dateTime={announcement.createdAt}>{formatTimestamp(announcement.createdAt)}</time>
        </div>
        <h2>{announcement.title}</h2>
        <p className="announcement-excerpt">{announcement.body}</p>
        <p className="announcement-byline">By {announcement.authorName}</p>
      </Link>
    </article>
  );
}

export function AnnouncementListPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [lastViewedAt] = useState(() =>
    user === null ? null : localStorage.getItem(getLastViewedKey(user.id)),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiListAnnouncements();
      setAnnouncements(response.announcements);
      if (user !== null) localStorage.setItem(getLastViewedKey(user.id), new Date().toISOString());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const canCompose = user?.role === 'officer' || user?.role === 'admin';
  return (
    <div className="announcement-page">
      <header className="announcement-heading">
        <div>
          <h1>Announcements</h1>
          <p>Pinned notices and the latest updates from your club organizers.</p>
        </div>
        {canCompose && (
          <Link
            to="/announcements/new"
            className="announcement-button announcement-button--primary"
          >
            <Plus size={17} aria-hidden="true" /> New announcement
          </Link>
        )}
      </header>
      {isLoading && <p className="announcement-loading">Loading announcements…</p>}
      {!isLoading && error !== null && (
        <AnnouncementError message={error} onRetry={() => void loadAnnouncements()} />
      )}
      {!isLoading && error === null && announcements.length === 0 && <EmptyAnnouncements />}
      {!isLoading && announcements.length > 0 && (
        <div className="announcement-list">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement._id}
              announcement={announcement}
              isUnread={
                lastViewedAt === null ||
                new Date(announcement.createdAt).getTime() > new Date(lastViewedAt).getTime()
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AnnouncementDetailPage() {
  const { announcementId } = useParams();
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnnouncement = useCallback(async () => {
    if (announcementId === undefined) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGetAnnouncement(announcementId);
      setAnnouncement(response.announcement);
      if (user !== null) localStorage.setItem(getLastViewedKey(user.id), new Date().toISOString());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [announcementId, user]);

  useEffect(() => {
    void loadAnnouncement();
  }, [loadAnnouncement]);

  const canEdit =
    announcement !== null &&
    user?.id === announcement.authorId &&
    (user.role === 'officer' || user.role === 'admin');
  return (
    <div className="announcement-page">
      <Link to="/announcements" className="announcement-back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Back to announcements
      </Link>
      {isLoading && <p className="announcement-loading">Loading announcement…</p>}
      {!isLoading && error !== null && (
        <AnnouncementError message={error} onRetry={() => void loadAnnouncement()} />
      )}
      {announcement !== null && (
        <article className="announcement-detail">
          <div className="announcement-detail-topline">
            <div className="announcement-badges">
              {announcement.isPinned && (
                <span className="announcement-badge announcement-badge--pinned">
                  <Pin size={12} aria-hidden="true" /> Pinned
                </span>
              )}
            </div>
            {canEdit && (
              <Link
                to={`/announcements/${announcement._id}/edit`}
                className="announcement-button announcement-button--secondary"
              >
                <Pencil size={16} aria-hidden="true" /> Edit
              </Link>
            )}
          </div>
          <h1>{announcement.title}</h1>
          <p className="announcement-detail-byline">
            By {announcement.authorName} ·{' '}
            <time dateTime={announcement.createdAt}>{formatTimestamp(announcement.createdAt)}</time>
          </p>
          <div className="announcement-body">{announcement.body}</div>
        </article>
      )}
    </div>
  );
}

export function AnnouncementComposerPage() {
  const { announcementId } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isLoading, setIsLoading] = useState(announcementId !== undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (announcementId === undefined) return;
    void (async () => {
      try {
        const response = await apiGetAnnouncement(announcementId);
        setTitle(response.announcement.title);
        setBody(response.announcement.body);
        setIsPinned(response.announcement.isPinned);
      } catch (loadError) {
        setError(getErrorMessage(loadError));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [announcementId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const input = { title, body, isPinned };
      const response =
        announcementId === undefined
          ? await apiCreateAnnouncement(input)
          : await apiUpdateAnnouncement(announcementId, input);
      navigate(`/announcements/${response.announcement._id}`);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  const heading = announcementId === undefined ? 'New announcement' : 'Edit announcement';
  if (isLoading) return <p className="announcement-loading">Loading announcement…</p>;
  return (
    <div className="announcement-page">
      <Link
        to={announcementId === undefined ? '/announcements' : `/announcements/${announcementId}`}
        className="announcement-back-link"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Cancel and go back
      </Link>
      <header className="announcement-heading">
        <div>
          <h1>{heading}</h1>
          <p>Share a clear club update with every member.</p>
        </div>
      </header>
      <form className="announcement-composer" onSubmit={(event) => void handleSubmit(event)}>
        <label className="announcement-field">
          <span>Title</span>
          <input
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="What should members know?"
          />
        </label>
        <label className="announcement-field">
          <span>Body</span>
          <textarea
            required
            maxLength={10000}
            rows={12}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write the full announcement…"
          />
        </label>
        <label className="announcement-pin-control">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(event) => setIsPinned(event.target.checked)}
          />
          <span>
            <strong>Pin this announcement</strong>
            Keep it above newer unpinned posts.
          </span>
        </label>
        {error !== null && (
          <p className="announcement-alert" role="alert">
            {error}
          </p>
        )}
        <button className="announcement-button announcement-button--primary" disabled={isSaving}>
          <Send size={17} aria-hidden="true" />
          {isSaving
            ? 'Saving…'
            : announcementId === undefined
              ? 'Publish announcement'
              : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
