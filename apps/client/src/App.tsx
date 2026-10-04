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
import { EventBookingPage } from './features/events/EventBookingPage';
import { EventCheckInPage } from './features/events/EventCheckInPage';
import { EventCreatePage } from './features/events/EventCreatePage';
import { EventDetailPage } from './features/events/EventDetailPage';
import { EventListPage } from './features/events/EventListPage';
import {
  ExpenseReviewPage,
  ExpenseSubmissionPage,
  TreasurerReportPage,
} from './features/expenses/ExpensePages';
import { LandingPage } from './features/landing/LandingPage';
import { CheckoutPage } from './features/memberships/CheckoutPage';
import { ManageMembershipsPage } from './features/memberships/ManageMembershipsPage';
import { MyMembershipPage } from './features/memberships/MyMembershipPage';
import { StoreManagePage } from './features/store/StoreManagePage';
import { StoreOrdersPage } from './features/store/StoreOrdersPage';
import { StorePage } from './features/store/StorePage';
import { StoreProductDetailPage } from './features/store/StoreProductDetailPage';
import { ManageTicketsPage } from './features/support/ManageTicketsPage';
import { MyTicketsPage } from './features/support/MyTicketsPage';
import { TaskBoardPage } from './features/tasks/TaskBoardPage';
import { MembersPage } from './features/users/MembersPage';
import { ProfilePage } from './features/users/ProfilePage';

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
            path="/events"
            element={
              <ProtectedRoute>
                <AppShell>
                  <EventListPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/new"
            element={
              <ProtectedRoute allowedRoles={['officer', 'admin']}>
                <AppShell>
                  <EventCreatePage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/:eventId/check-in"
            element={
              <ProtectedRoute allowedRoles={['officer', 'admin']}>
                <AppShell>
                  <EventCheckInPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/:eventId/book"
            element={
              <ProtectedRoute>
                <AppShell>
                  <EventBookingPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/events/:eventId"
            element={
              <ProtectedRoute>
                <AppShell>
                  <EventDetailPage />
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
            path="/members"
            element={
              <ProtectedRoute requiredRole="admin">
                <AppShell>
                  <MembersPage />
                </AppShell>
              </ProtectedRoute>
            }
          />


          <Route
            path="/checkout/:tierId"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/manage/memberships"
            element={
              <ProtectedRoute requiredRole="admin">
                <AppShell>
                  <ManageMembershipsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/tasks"
            element={
              <ProtectedRoute allowedRoles={['officer']}>
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

          <Route
            path="/support"
            element={
              <ProtectedRoute allowedRoles={['member', 'officer', 'treasurer']}>
                <AppShell>
                  <MyTicketsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/manage/support"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppShell>
                  <ManageTicketsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ProfilePage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<LandingPage />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
