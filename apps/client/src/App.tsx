/**
 * Root application component — Phase 2.
 *
 * Sets up React Router and wraps the entire app in the AuthProvider.
 * Public routes: /login, /register
 * Protected routes: /dashboard, /membership, /manage/memberships (officer+), and future pages.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider } from './features/auth/AuthContext';
import { LoginPage } from './features/auth/LoginPage';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { RegisterPage } from './features/auth/RegisterPage';
import { AppShell } from './features/dashboard/AppShell';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ManageMembershipsPage } from './features/memberships/ManageMembershipsPage';
import { MyMembershipPage } from './features/memberships/MyMembershipPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/membership"
            element={
              <ProtectedRoute>
                <AppShell>
                  <MyMembershipPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/manage/memberships"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ManageMembershipsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* Redirect root → dashboard (ProtectedRoute will redirect to /login if not auth'd) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
