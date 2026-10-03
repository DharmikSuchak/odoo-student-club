const API_BASE = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '';

export interface ApiError {
  status: 'error';
  message: string;
  fields?: Record<string, string[]> | undefined;
}

export class ApiRequestError extends Error implements ApiError {
  status: 'error';
  fields?: Record<string, string[]> | undefined;

  constructor(data: ApiError) {
    super(data.message);
    this.name = 'ApiRequestError';
    this.status = data.status;
    if ('fields' in data) {
      this.fields = data.fields;
    }
  }
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: 'member' | 'officer' | 'treasurer' | 'admin';
  createdAt?: string;
}

export interface AuthResponse {
  status: 'ok';
  user: AuthUser;
}

export interface MessageResponse {
  status: 'ok';
  message: string;
}

export interface ApiHealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  environment: string;
}

export type MembershipStatus = 'pending_payment' | 'active' | 'expired' | 'cancelled';

export interface MembershipTier {
  _id: string;
  name: string;
  description?: string;
  durationDays: number;
  priceCents: number;
  isActive: boolean;
  clubId: string;
}

export interface Membership {
  _id: string;
  userId: string;
  tierId: string;
  clubId: string;
  status: MembershipStatus;
  startDate: string;
  endDate: string;
  paidAt?: string;
  amountPaidCents?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipResponse {
  status: 'ok';
  membership: Membership | null;
  isActive: boolean;
}

export interface MembershipsListResponse {
  status: 'ok';
  memberships: Membership[];
}

export interface TiersListResponse {
  status: 'ok';
  tiers: MembershipTier[];
}

export interface CreateTierResponse {
  status: 'ok';
  tier: MembershipTier;
}

export interface CreateMembershipResponse {
  status: 'ok';
  membership: Membership;
}

export async function fetchApiHealth(): Promise<ApiHealthResponse> {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) {
    throw new Error(`API returned ${response.status.toString()} ${response.statusText}`);
  }
  return response.json() as Promise<ApiHealthResponse>;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include', // Always send HTTP-only cookies
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    throw new ApiRequestError(data as ApiError);
  }

  return data as T;
}

export async function apiRegister(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiLogout(): Promise<MessageResponse> {
  return apiFetch<MessageResponse>('/api/auth/logout', { method: 'POST' });
}

export async function apiGetCurrentUser(): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/me');
}

export async function apiUpdateProfile(displayName: string, avatarUrl?: string): Promise<{status: 'ok', user: AuthUser}> {
  return apiFetch<{status: 'ok', user: AuthUser}>('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify({ displayName, avatarUrl }),
  });
}

export interface UsersListResponse {
  status: 'ok';
  users: AuthUser[];
}

export async function apiGetUsers(): Promise<UsersListResponse> {
  return apiFetch<UsersListResponse>('/api/users');
}

export async function apiCreateUser(
  email: string,
  password: string,
  displayName: string,
  role: 'member' | 'officer' | 'treasurer' | 'admin'
): Promise<{ status: 'ok'; user: AuthUser }> {
  return apiFetch<{ status: 'ok'; user: AuthUser }>('/api/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName, role }),
  });
}

export async function apiGetMyMembership(): Promise<MembershipResponse> {
  return apiFetch<MembershipResponse>('/api/memberships/me');
}

export async function apiGetTiers(): Promise<TiersListResponse> {
  return apiFetch<TiersListResponse>('/api/memberships/tiers');
}

export async function apiCreateTier(
  name: string,
  description: string | undefined,
  durationDays: number,
  priceCents: number,
): Promise<CreateTierResponse> {
  return apiFetch<CreateTierResponse>('/api/memberships/tiers', {
    method: 'POST',
    body: JSON.stringify({ name, description, durationDays, priceCents }),
  });
}

export async function apiSimulatePayment(tierId: string): Promise<{ status: 'ok' }> {
  return apiFetch<{ status: 'ok' }>('/api/payments/simulate', {
    method: 'POST',
    body: JSON.stringify({ tierId }),
  });
}

export interface CheckoutResponse {
  status: 'ok';
  url: string;
}

export async function apiCreateCheckoutSession(tierId: string): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>('/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify({ tierId }),
  });
}

export async function apiCheckoutEventTicket(ticketId: string): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>('/api/stripe/checkout-event', {
    method: 'POST',
    body: JSON.stringify({ ticketId }),
  });
}

export async function apiCheckoutStoreOrder(orderId: string): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>('/api/stripe/checkout-store', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });
}

export async function apiSimulateStorePayment(orderId: string): Promise<{ status: 'ok' }> {
  return apiFetch<{ status: 'ok' }>('/api/payments/simulate-store', {
    method: 'POST',
    body: JSON.stringify({ orderId }),
  });
}

export async function apiListMemberships(status?: string): Promise<MembershipsListResponse> {
  const query = status !== undefined ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<MembershipsListResponse>(`/api/memberships${query}`);
}

export async function apiSendRenewalReminders(): Promise<{ status: 'ok'; sentCount: number }> {
  return apiFetch<{ status: 'ok'; sentCount: number }>('/api/memberships/send-reminders', {
    method: 'POST',
  });
}

export async function apiCreateMembership(
  userId: string,
  tierId: string,
  startDate: string,
  endDate: string,
): Promise<CreateMembershipResponse> {
  return apiFetch<CreateMembershipResponse>('/api/memberships', {
    method: 'POST',
    body: JSON.stringify({ userId, tierId, startDate, endDate }),
  });
}

export async function apiRecordManualPayment(
  membershipId: string,
  amountPaidCents: number,
): Promise<CreateMembershipResponse> {
  return apiFetch<CreateMembershipResponse>(`/api/memberships/${membershipId}/record-payment`, {
    method: 'POST',
    body: JSON.stringify({ amountPaidCents }),
  });
}

export type ExpenseStatus = 'pending' | 'approved' | 'rejected' | 'reimbursed';

export interface Expense {
  _id: string;
  clubId: string;
  submittedBy: string;
  reviewedBy?: string;
  reimbursedBy?: string;
  category: string;
  amountCents: number;
  currency: string;
  receiptReference: string;
  status: ExpenseStatus;
  reviewedAt?: string;
  reimbursedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MoneyBreakdown {
  settled: number;
  pending: number;
  total: number;
}

export interface TreasurerCurrencySummary {
  currency: string;
  dues: MoneyBreakdown;
  ticketRevenue: MoneyBreakdown;
  merchandiseRevenue: MoneyBreakdown;
  income: MoneyBreakdown;
  outgoing: MoneyBreakdown;
  balance: { settled: number; projected: number };
  expenseCounts: {
    pendingReview: number;
    awaitingReimbursement: number;
    reimbursed: number;
  };
}

interface ExpenseResponse {
  status: 'ok';
  expense: Expense;
}

interface ExpenseListResponse {
  status: 'ok';
  expenses: Expense[];
}

interface TreasurerReportResponse {
  status: 'ok';
  summaries: TreasurerCurrencySummary[];
  generatedAt: string;
}

export async function apiCreateExpense(input: {
  category: string;
  amountCents: number;
  currency: string;
  receiptReference: string;
}): Promise<ExpenseResponse> {
  return apiFetch<ExpenseResponse>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiListMyExpenses(): Promise<ExpenseListResponse> {
  return apiFetch<ExpenseListResponse>('/api/expenses/mine');
}

export async function apiListExpenses(status?: ExpenseStatus): Promise<ExpenseListResponse> {
  const query = status === undefined ? '' : `?status=${encodeURIComponent(status)}`;
  return apiFetch<ExpenseListResponse>(`/api/expenses${query}`);
}

export async function apiReviewExpense(
  expenseId: string,
  decision: 'approved' | 'rejected',
): Promise<ExpenseResponse> {
  return apiFetch<ExpenseResponse>(`/api/expenses/${expenseId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision }),
  });
}

export async function apiReimburseExpense(expenseId: string): Promise<ExpenseResponse> {
  return apiFetch<ExpenseResponse>(`/api/expenses/${expenseId}/reimburse`, { method: 'PATCH' });
}

export async function apiGetTreasurerReport(): Promise<TreasurerReportResponse> {
  return apiFetch<TreasurerReportResponse>('/api/expenses/report');
}

export interface DashboardSummary {
  activeMembers: number;
  upcomingEvents: number;
  openTasks: number;
  pendingDues: number;
}

interface DashboardSummaryResponse {
  status: 'ok';
  summary: DashboardSummary;
}

export async function apiGetDashboardSummary(): Promise<DashboardSummaryResponse> {
  return apiFetch<DashboardSummaryResponse>('/api/dashboard/summary');
}

export interface Announcement {
  _id: string;
  clubId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AnnouncementResponse {
  status: 'ok';
  announcement: Announcement;
}

interface AnnouncementListResponse {
  status: 'ok';
  announcements: Announcement[];
}

export async function apiListAnnouncements(): Promise<AnnouncementListResponse> {
  return apiFetch<AnnouncementListResponse>('/api/announcements');
}

export async function apiGetAnnouncement(announcementId: string): Promise<AnnouncementResponse> {
  return apiFetch<AnnouncementResponse>(`/api/announcements/${announcementId}`);
}

export async function apiCreateAnnouncement(input: {
  title: string;
  body: string;
  isPinned: boolean;
}): Promise<AnnouncementResponse> {
  return apiFetch<AnnouncementResponse>('/api/announcements', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateAnnouncement(
  announcementId: string,
  input: { title: string; body: string; isPinned: boolean },
): Promise<AnnouncementResponse> {
  return apiFetch<AnnouncementResponse>(`/api/announcements/${announcementId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export type TaskStatus = 'not_started' | 'in_progress' | 'done';

export interface VolunteerTask {
  _id: string;
  clubId: string;
  createdBy: string;
  createdByName: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStatusSummary {
  notStarted: number;
  inProgress: number;
  done: number;
  total: number;
}

export interface AssignableMember {
  id: string;
  displayName: string;
  role: AuthUser['role'];
}

interface TaskResponse {
  status: 'ok';
  task: VolunteerTask;
}

interface TaskBoardResponse {
  status: 'ok';
  tasks: VolunteerTask[];
  summary: TaskStatusSummary;
}

interface AssignableMembersResponse {
  status: 'ok';
  members: AssignableMember[];
}

export async function apiListTasks(): Promise<TaskBoardResponse> {
  return apiFetch<TaskBoardResponse>('/api/tasks');
}

export async function apiListAssignableMembers(): Promise<AssignableMembersResponse> {
  return apiFetch<AssignableMembersResponse>('/api/tasks/members');
}

export async function apiCreateTask(input: {
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
}): Promise<TaskResponse> {
  return apiFetch<TaskResponse>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiAssignTask(
  taskId: string,
  assigneeId: string | null,
): Promise<TaskResponse> {
  return apiFetch<TaskResponse>(`/api/tasks/${taskId}/assignee`, {
    method: 'PATCH',
    body: JSON.stringify({ assigneeId }),
  });
}

export async function apiUpdateTaskStatus(
  taskId: string,
  status: TaskStatus,
): Promise<TaskResponse> {
  return apiFetch<TaskResponse>(`/api/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

// ── Club Store ────────────────────────────────────────────────────────────────

export interface MerchandiseVariant {
  size: string;
  stockQuantity: number;
}

export interface MerchandiseProduct {
  _id: string;
  clubId: string;
  createdBy: string;
  name: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  variants: MerchandiseVariant[];
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus = 'pending_payment' | 'paid' | 'fulfilled' | 'cancelled';

export interface StoreOrder {
  _id: string;
  userId: string;
  clubId: string;
  itemId: string;
  itemName: string;
  size: string;
  quantity: 1;
  unitPriceCents: number;
  totalCents: number;
  currency: string;
  status: OrderStatus;
  paymentId?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProductResponse {
  status: 'ok';
  product: MerchandiseProduct;
}

interface ProductListResponse {
  status: 'ok';
  products: MerchandiseProduct[];
}

interface OrderResponse {
  status: 'ok';
  order: StoreOrder;
}

interface OrderListResponse {
  status: 'ok';
  orders: StoreOrder[];
}

export async function apiListProducts(): Promise<ProductListResponse> {
  return apiFetch<ProductListResponse>('/api/store/products');
}

export async function apiGetProduct(productId: string): Promise<ProductResponse> {
  return apiFetch<ProductResponse>(`/api/store/products/${productId}`);
}

export async function apiCreateProduct(input: {
  name: string;
  priceCents: number;
  currency: string;
  imageUrl?: string;
  variants: MerchandiseVariant[];
}): Promise<ProductResponse> {
  return apiFetch<ProductResponse>('/api/store/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiUpdateProduct(
  productId: string,
  input: {
    name: string;
    priceCents: number;
    currency: string;
    imageUrl?: string;
    variants: MerchandiseVariant[];
  },
): Promise<ProductResponse> {
  return apiFetch<ProductResponse>(`/api/store/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function apiPlaceOrder(itemId: string, size: string): Promise<OrderResponse> {
  return apiFetch<OrderResponse>('/api/store/orders', {
    method: 'POST',
    body: JSON.stringify({ itemId, size }),
  });
}

export async function apiListMyOrders(): Promise<OrderListResponse> {
  return apiFetch<OrderListResponse>('/api/store/orders/mine');
}

export type EventTicketStatus = 'pending_payment' | 'confirmed' | 'waitlisted' | 'cancelled';

export interface ClubEvent {
  _id: string;
  clubId: string;
  createdBy: string;
  title: string;
  description: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  isPublished: boolean;
  hasTickets: boolean;
  ticketCapacity: number;
  remainingTicketCount: number;
  registrationDeadline?: string;
  memberPriceCents: number;
  nonMemberPriceCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventTicket {
  _id: string;
  clubId: string;
  eventId: string;
  userId: string;
  status: EventTicketStatus;
  priceCents: number;
  currency: string;
  memberPriceApplied: boolean;
  paymentId?: string;
  paidAt?: string;
  checkedInAt?: string;
  checkedInBy?: string;
  requestedAt: string;
  attendeeName: string;
  attendeeEmail: string;
}

interface EventResponse {
  status: 'ok';
  event: ClubEvent;
}

interface EventDetailResponse extends EventResponse {
  ticket: EventTicket | null;
}

interface EventListResponse {
  status: 'ok';
  events: ClubEvent[];
}

interface EventTicketResponse {
  status: 'ok';
  ticket: EventTicket;
}

interface EventTicketListResponse {
  status: 'ok';
  tickets: EventTicket[];
}

export interface CreateEventInput {
  title: string;
  description: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  ticketCapacity: number;
  registrationDeadline?: string;
  memberPriceCents: number;
  nonMemberPriceCents: number;
  currency: string;
  isPublished: boolean;
}

export async function apiListEvents(includeDrafts = false): Promise<EventListResponse> {
  return apiFetch<EventListResponse>(`/api/events${includeDrafts ? '?includeDrafts=true' : ''}`);
}

export async function apiGetEvent(eventId: string): Promise<EventDetailResponse> {
  return apiFetch<EventDetailResponse>(`/api/events/${eventId}`);
}

export async function apiCreateEvent(input: CreateEventInput): Promise<EventResponse> {
  return apiFetch<EventResponse>('/api/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiPublishEvent(eventId: string): Promise<EventResponse> {
  return apiFetch<EventResponse>(`/api/events/${eventId}/publish`, { method: 'PATCH' });
}

export async function apiRequestEventTicket(eventId: string): Promise<EventTicketResponse> {
  return apiFetch<EventTicketResponse>(`/api/events/${eventId}/tickets`, {
    method: 'POST',
  });
}

export async function apiListEventTickets(eventId: string): Promise<EventTicketListResponse> {
  return apiFetch<EventTicketListResponse>(`/api/events/${eventId}/tickets`);
}

export async function apiCheckInEventTicket(
  eventId: string,
  ticketId: string,
): Promise<EventTicketResponse> {
  return apiFetch<EventTicketResponse>(`/api/events/${eventId}/tickets/${ticketId}/check-in`, {
    method: 'PATCH',
  });
}

// ── Support Tickets ────────────────────────────────────────────────────────────

export interface SupportTicket {
  _id: string;
  clubId: string;
  userId: string;
  userName: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface SupportTicketResponse {
  status: 'ok';
  ticket: SupportTicket;
}

export interface SupportTicketListResponse {
  status: 'ok';
  tickets: SupportTicket[];
}

export async function apiCreateSupportTicket(
  subject: string,
  description: string,
): Promise<SupportTicketResponse> {
  return apiFetch<SupportTicketResponse>('/api/support', {
    method: 'POST',
    body: JSON.stringify({ subject, description }),
  });
}

export async function apiListMySupportTickets(): Promise<SupportTicketListResponse> {
  return apiFetch<SupportTicketListResponse>('/api/support/mine');
}

export async function apiListAllSupportTickets(): Promise<SupportTicketListResponse> {
  return apiFetch<SupportTicketListResponse>('/api/support');
}

export async function apiUpdateSupportTicketStatus(
  ticketId: string,
  status: 'open' | 'in_progress' | 'resolved',
): Promise<SupportTicketResponse> {
  return apiFetch<SupportTicketResponse>(`/api/support/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
