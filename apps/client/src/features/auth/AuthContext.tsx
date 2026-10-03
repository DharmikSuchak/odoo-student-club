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
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
