/**
 * Root application component — Phase 2.
 *
 * Sets up React Router and wraps the entire app in the AuthProvider.
 * Public routes: /login, /register
 * Protected routes: /dashboard, /membership, /manage/memberships (officer+), and future pages.
 */
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import {
  AnnouncementComposerPage,
  AnnouncementDetailPage,
  AnnouncementListPage,
} from './features/announcements/AnnouncementPages';
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
import { StoreManagePage } from './features/store/StoreManagePage';
import { StoreOrdersPage } from './features/store/StoreOrdersPage';
import { StorePage } from './features/store/StorePage';
import { StoreProductDetailPage } from './features/store/StoreProductDetailPage';
import { TaskBoardPage } from './features/tasks/TaskBoardPage';

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
            path="/announcements"
            element={
              <ProtectedRoute>
                <AppShell>
                  <AnnouncementListPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/announcements/new"
            element={
              <ProtectedRoute allowedRoles={['officer', 'admin']}>
                <AppShell>
                  <AnnouncementComposerPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/announcements/:announcementId/edit"
            element={
              <ProtectedRoute allowedRoles={['officer', 'admin']}>
                <AppShell>
                  <AnnouncementComposerPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/announcements/:announcementId"
            element={
              <ProtectedRoute>
                <AppShell>
                  <AnnouncementDetailPage />
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
            path="/tasks"
            element={
              <ProtectedRoute>
                <AppShell>
                  <TaskBoardPage />
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

          {/* ── Club Store ── */}
          <Route
            path="/merchandise"
            element={
              <ProtectedRoute>
                <AppShell>
                  <StorePage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* orders must appear before /:productId so it matches first */}
          <Route
            path="/merchandise/orders"
            element={
              <ProtectedRoute>
                <AppShell>
                  <StoreOrdersPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* manage is officer+ — ProtectedRoute AND server both enforce this */}
          <Route
            path="/merchandise/manage"
            element={
              <ProtectedRoute requiredRole="officer">
                <AppShell>
                  <StoreManagePage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/merchandise/:productId"
            element={
              <ProtectedRoute>
                <AppShell>
                  <StoreProductDetailPage />
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
