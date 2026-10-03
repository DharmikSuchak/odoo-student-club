/**
 * Authentication context and provider.
 *
 * Manages the authenticated user state, loading status, and error messages.
 * All auth state changes (login, register, logout) go through this context
 * so any component can react to auth state without prop-drilling.
 */
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  apiGetCurrentUser,
  apiLogin,
  apiLogout,
  apiRegister,
  type AuthUser,
} from '../../lib/api-client';

export interface AuthContextValue {
  /** The currently authenticated user, or null if not logged in. */
  user: AuthUser | null;
  /** True while the initial session check (GET /me) is in progress. */
  isLoading: boolean;
  /** True after the initial session check has completed (success or failure). */
  isInitialized: boolean;
  /**
   * Attempts to log the user in.
   * @throws {ApiError} on failure.
   */
  login: (email: string, password: string) => Promise<void>;
  /**
   * Attempts to register a new account.
   * @throws {ApiError} on failure.
   */
  register: (email: string, password: string, displayName: string) => Promise<void>;
  /**
   * Signs the current user out.
   * @throws {ApiError} on failure.
   */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Wraps the application with authentication state.
 *
 * On mount, attempts to restore session by calling GET /api/auth/me.
 * If the request returns 401, the user is treated as unauthenticated.
 *
 * @param children  Child components.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Restore session on page load / refresh
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await apiGetCurrentUser();
        if (!cancelled) {
          setUser(response.user);
        }
      } catch {
        // 401 → not authenticated. Any other error → treat as unauthenticated.
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsInitialized(true);
        }
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await apiLogin(email, password);
    setUser(response.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string): Promise<void> => {
      const response = await apiRegister(email, password, displayName);
      setUser(response.user);
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    await apiLogout();
    setUser(null);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoading,
    isInitialized,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Returns the auth context value.
 *
 * @throws {Error} If called outside of an {@link AuthProvider}.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
