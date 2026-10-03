/**
 * ProtectedRoute — wraps routes that require authentication.
 *
 * Waits for the auth context to initialize (session check), then:
 *   - Renders children if authenticated.
 *   - Redirects to /login if not authenticated.
 *   - Shows a full-screen loading spinner while initializing.
 *
 * Optionally enforces a minimum role level.
 *
 * @param requiredRole  Minimum role. Omit for any authenticated user.
 */
import { Navigate } from 'react-router-dom';

import type { AuthUser } from '../../lib/api-client';

import { useAuth } from './AuthContext';

const ROLE_ORDER: AuthUser['role'][] = ['member', 'officer', 'treasurer', 'admin'];

/**
 * Returns true if `userRole` satisfies `requiredRole`.
 * The ordering is: member < officer < treasurer < admin.
 */
function hasRequiredRole(userRole: AuthUser['role'], requiredRole: AuthUser['role']): boolean {
  return ROLE_ORDER.indexOf(userRole) >= ROLE_ORDER.indexOf(requiredRole);
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: AuthUser['role'];
}

export function ProtectedRoute({ children, requiredRole = 'member' }: ProtectedRouteProps) {
  const { user, isLoading, isInitialized } = useAuth();

  if (isLoading || !isInitialized) {
    return (
      <div className="loading-screen" role="status" aria-label="Loading">
        <div className="loading-spinner" />
        <p className="loading-text">Loading…</p>
      </div>
    );
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRequiredRole(user.role, requiredRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
