import { AlertCircle, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Dialog } from '../../components/Dialog';
import type { ApiError, AuthUser } from '../../lib/api-client';
import { apiGetUsers, apiCreateUser } from '../../lib/api-client';
import { useAuth } from '../auth/AuthContext';

export function MembersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'officer' as 'member' | 'officer' | 'treasurer' | 'admin',
  });

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const response = await apiGetUsers();
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
  }, []);



  const filteredUsers = users.filter((u) => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await apiCreateUser(createForm.email, createForm.password, createForm.displayName, createForm.role);
      setUsers([...users, res.user]);
      setIsDialogOpen(false);
      setCreateForm({ displayName: '', email: '', password: '', role: 'officer' });
    } catch (err) {
      const apiErr = err as ApiError;
      setCreateError(apiErr.message ?? 'Failed to create user.');
    } finally {
      setIsCreating(false);
    }
  }

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
        <Dialog titleId="create-user-title" onClose={() => setIsDialogOpen(false)}>
          <div style={{ padding: '1.5rem', width: '400px', maxWidth: '100%' }}>
            <h2 id="create-user-title" style={{ marginBottom: '1.5rem', fontSize: '1.25rem', fontWeight: 600 }}>Create New User</h2>
            <form onSubmit={(e) => void handleCreateUser(e)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {createError && (
                <div className="ms-error" style={{ marginBottom: '1rem' }}>
                  <AlertCircle size={20} />
                  <p>{createError}</p>
                </div>
              )}
              <div className="ms-form-group">
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
              <div className="ms-form-group">
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
              <div className="ms-form-group">
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
              <div className="ms-form-group">
                <label className="ms-label" htmlFor="role">Role</label>
                <select
                  id="role"
                  className="ms-input"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as any })}
                >
                  <option value="member">Member</option>
                  <option value="officer">Officer (Volunteer)</option>
                  <option value="treasurer">Treasurer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="ms-btn" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>
                  Cancel
                </button>
                <button type="submit" className="ms-btn ms-btn--primary" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </Dialog>
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
          <div style={{ marginBottom: '1rem', display: 'flex' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
              <input 
                type="text" 
                placeholder="Search by name or email..." 
                className="ms-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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
                          {user.role}
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
