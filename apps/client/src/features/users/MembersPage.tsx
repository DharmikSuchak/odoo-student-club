import { AlertCircle, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Dialog } from '../../components/Dialog';
import type { ApiError, AuthUser } from '../../lib/api-client';
import { apiGetUsers, apiCreateUser } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';
import '../memberships/membership.css';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (user: AuthUser) => void;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'officer' as 'member' | 'officer' | 'treasurer' | 'admin',
  });

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await apiCreateUser(createForm.email, createForm.password, createForm.displayName, createForm.role);
      onCreated(res.user);
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      setCreateError(apiErr.message ?? 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Dialog titleId="create-user-title" onClose={onClose}>
      <div className="ms-modal">
        <div className="ms-modal-header">
          <h2 id="create-user-title" className="ms-modal-title">Create New User</h2>
          <button
            type="button"
            className="ms-modal-close"
            onClick={onClose}
            disabled={isCreating}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>
        <form className="ms-form" onSubmit={(e) => void handleCreateUser(e)} style={{ padding: '1.5rem' }}>
          {createError && (
            <div className="ms-alert ms-alert--error" role="alert" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={20} />
              <span>{createError}</span>
            </div>
          )}
          <div className="ms-field">
            <label className="ms-label" htmlFor="displayName">Name</label>
            <input
              id="displayName"
              type="text"
              required
              className="ms-input"
              value={createForm.displayName}
              onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
            />
          </div>
          <div className="ms-field">
            <label className="ms-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="ms-input"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
          </div>
          <div className="ms-field">
            <label className="ms-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              className="ms-input"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            />
          </div>
          <div className="ms-field">
            <label className="ms-label" htmlFor="role">Role</label>
            <select
              id="role"
              className="ms-select"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'member' | 'officer' | 'treasurer' | 'admin' })}
            >
              <option value="officer">Volunteer</option>
              <option value="treasurer">Treasurer</option>
            </select>
          </div>
          <div className="ms-modal-footer">
            <button type="button" className="ms-btn ms-btn--ghost" onClick={onClose} disabled={isCreating}>
              Cancel
            </button>
            <button type="submit" className="ms-btn ms-btn--primary" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}

export function MembersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [roleFilter, setRoleFilter] = useState('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const response = await apiGetUsers(roleFilter);
        if (!cancelled) {
          setUsers(response.users);
        }
      } catch (err) {
        if (!cancelled) {
          const apiErr = err as ApiError;
          setError(apiErr.message ?? 'Failed to load members.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [roleFilter]);

  const filteredUsers = users.filter((u) => 
    u.displayName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  return (
    <div className="memberships-page">
      <div className="memberships-heading-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="memberships-title">Members Directory</h1>
          <p className="memberships-subtitle">
            View all registered users and their details.
          </p>
        </div>
        {currentUser?.role === 'admin' && (
          <button className="ms-btn ms-btn--primary" onClick={() => setIsDialogOpen(true)}>
            Add User
          </button>
        )}
      </div>

      {isDialogOpen && (
        <CreateUserModal
          onClose={() => setIsDialogOpen(false)}
          onCreated={(newUser) => setUsers([...users, newUser])}
        />
      )}

      {isLoading && <p>Loading members...</p>}

      {!isLoading && error !== null && (
        <div className="ms-error" role="alert">
          <AlertCircle size={24} aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {!isLoading && error === null && (
        <>
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                className="ms-input"
                style={{ width: '100%' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ position: 'relative', width: '200px' }}>
              <select 
                className="ms-input" 
                style={{ width: '100%', cursor: 'pointer' }}
                value={roleFilter} 
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="member">Member</option>
                <option value="officer">Volunteer</option>
                <option value="treasurer">Treasurer</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          
          <div className="ms-table-container">
            <table className="ms-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>
                      <div className="ms-empty">
                        <Users size={32} />
                        <h2 className="ms-empty-title">No members found</h2>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td style={{ fontWeight: 500 }}>{user.displayName}</td>
                      <td>{user.email}</td>
                      <td>
                        <span className={`sidebar-user-role sidebar-user-role--${user.role}`}>
                          {user.role === 'officer' ? 'Volunteer' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
