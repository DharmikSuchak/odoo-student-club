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
import {
  ExpenseReviewPage,
  ExpenseSubmissionPage,
  TreasurerReportPage,
} from './features/expenses/ExpensePages';
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
              <ProtectedRoute requiredRole="officer">
                <AppShell>
                  <ManageMembershipsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/expenses"
            element={
              <ProtectedRoute requiredRole="officer">
                <AppShell>
                  <ExpenseSubmissionPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/treasurer/expenses"
            element={
              <ProtectedRoute requiredRole="treasurer">
                <AppShell>
                  <ExpenseReviewPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/treasurer/report"
            element={
              <ProtectedRoute requiredRole="treasurer">
                <AppShell>
                  <TreasurerReportPage />
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
