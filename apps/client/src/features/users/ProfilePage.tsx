import { AlertCircle, CheckCircle, Camera } from 'lucide-react';
import { useState } from 'react';

import type { ApiError } from '../../lib/api-client';
import { apiUpdateProfile } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';

import './users.css';

export function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await apiUpdateProfile(displayName, avatarUrl || undefined);
      // Let AuthContext know the user is updated so SidebarUser gets the new avatar/name
      updateUser(res.user);
      setSuccess(true);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? 'Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="users-page" style={{ maxWidth: '600px' }}>
      <div className="users-heading-row">
        <div>
          <h1 className="users-title">My Profile</h1>
          <p className="users-subtitle">Manage your account settings and profile picture.</p>
        </div>
      </div>

      <form className="users-card" onSubmit={(e) => void handleSubmit(e)} noValidate>
        {success && (
          <div className="users-notice users-notice--success" role="status" style={{ marginBottom: '1.5rem' }}>
            <CheckCircle size={18} aria-hidden="true" />
            <span>Profile updated successfully.</span>
          </div>
        )}

        {error !== null && (
          <div className="users-notice users-notice--danger" role="alert" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: 'var(--slate-100)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            border: '1px solid var(--slate-200)',
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Camera size={32} color="var(--slate-400)" />
            )}
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem', color: 'var(--slate-900)' }}>{displayName || 'Your Name'}</h3>
            <p style={{ margin: 0, color: 'var(--slate-500)', fontSize: '0.875rem' }}>Role: <span style={{ textTransform: 'capitalize' }}>{user.role}</span></p>
          </div>
        </div>

        <div className="users-field" style={{ marginBottom: '1.5rem' }}>
          <label className="users-label" htmlFor="profile-email">
            Email Address (Permanent)
          </label>
          <input
            id="profile-email"
            type="email"
            className="users-input"
            value={user.email}
            disabled
            style={{ backgroundColor: 'var(--slate-50)', color: 'var(--slate-500)' }}
          />
        </div>

        <div className="users-field" style={{ marginBottom: '1.5rem' }}>
          <label className="users-label" htmlFor="profile-name">
            Display Name
          </label>
          <input
            id="profile-name"
            type="text"
            className="users-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div className="users-field" style={{ marginBottom: '2rem' }}>
          <label className="users-label" htmlFor="profile-avatar">
            Profile Photo URL
          </label>
          <input
            id="profile-avatar"
            type="url"
            className="users-input"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.5rem' }}>
            Provide a direct link to an image.
          </p>
        </div>

        <button
          type="submit"
          className="users-btn-primary"
          disabled={isSaving}
          aria-busy={isSaving}
          style={{ width: '100%' }}
        >
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
