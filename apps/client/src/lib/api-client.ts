/**
 * Typed API client for the Student Club Platform.
 *
 * All requests go through this module so that:
 *   1. Credentials (cookies) are always included.
 *   2. Error handling is consistent.
 *   3. The base URL can be swapped via environment variable.
 */

/** The API base URL. In dev the Vite proxy handles /api → localhost:3001. */
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

export interface CreateMembershipResponse {
  status: 'ok';
  membership: Membership;
}

/**
 * Fetches the API health endpoint and returns the JSON body.
 *
 * @throws {Error} If the network request fails or the server returns non-2xx.
 */
export async function fetchApiHealth(): Promise<ApiHealthResponse> {
  const response = await fetch(`${API_BASE}/api/health`);
  if (!response.ok) {
    throw new Error(`API returned ${response.status.toString()} ${response.statusText}`);
  }
  return response.json() as Promise<ApiHealthResponse>;
}

/**
 * Performs a fetch call to the API with credentials and JSON body.
 *
 * @param path     API path (e.g. `/api/auth/login`).
 * @param options  Fetch options to merge.
 * @returns Parsed JSON response typed as `T`.
 * @throws {ApiError} On HTTP errors with structured error info.
 */
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

/**
 * Registers a new member account.
 *
 * @param email        Valid email address.
 * @param password     Minimum 8 characters.
 * @param displayName  Public display name.
 * @returns The new user's safe profile.
 */
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

/**
 * Authenticates with email + password.
 *
 * On success, the server sets an HTTP-only `access_token` cookie.
 *
 * @param email     Account email.
 * @param password  Account password.
 * @returns The authenticated user's safe profile.
 */
export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Signs the current user out by clearing the auth cookie server-side.
 */
export async function apiLogout(): Promise<MessageResponse> {
  return apiFetch<MessageResponse>('/api/auth/logout', { method: 'POST' });
}

/**
 * Returns the currently authenticated user's profile.
 *
 * @throws {ApiError} 401 if not authenticated.
 */
export async function apiGetCurrentUser(): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/api/auth/me');
}

/**
 * Fetches the current user's membership status.
 *
 * @returns Membership (or null) and isActive flag.
 */
export async function apiGetMyMembership(): Promise<MembershipResponse> {
  return apiFetch<MembershipResponse>('/api/memberships/me');
}

/**
 * Fetches all membership tiers available for the club.
 *
 * @returns List of active membership tiers.
 */
export async function apiGetTiers(): Promise<TiersListResponse> {
  return apiFetch<TiersListResponse>('/api/memberships/tiers');
}

/**
 * Fetches all memberships (organizer/treasurer/admin only).
 *
 * @param status  Optional status filter.
 * @returns List of memberships.
 */
export async function apiListMemberships(status?: string): Promise<MembershipsListResponse> {
  const query = status !== undefined ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<MembershipsListResponse>(`/api/memberships${query}`);
}

/**
 * Creates a new membership for a user (officer+ only).
 *
 * @param userId     Target user's ID.
 * @param tierId     Membership tier ID.
 * @param startDate  ISO 8601 start date string.
 * @param endDate    ISO 8601 end date string.
 * @returns The created membership.
 */
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

/**
 * Records a manual (cash/offline) payment and activates a membership.
 *
 * ⚠️  This is NOT an online payment. It records that a treasurer manually
 *     accepted cash or a bank transfer.
 *
 * @param membershipId     The membership to activate.
 * @param amountPaidCents  Amount received in minor units (e.g. paise).
 * @returns The updated (active) membership.
 */
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

/** Submits an organizer expense in pending state. */
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

/** Lists expenses submitted by the current organizer. */
export async function apiListMyExpenses(): Promise<ExpenseListResponse> {
  return apiFetch<ExpenseListResponse>('/api/expenses/mine');
}

/** Lists expenses for treasurer review, optionally filtered by status. */
export async function apiListExpenses(status?: ExpenseStatus): Promise<ExpenseListResponse> {
  const query = status === undefined ? '' : `?status=${encodeURIComponent(status)}`;
  return apiFetch<ExpenseListResponse>(`/api/expenses${query}`);
}

/** Records the treasurer's approval or rejection decision. */
export async function apiReviewExpense(
  expenseId: string,
  decision: 'approved' | 'rejected',
): Promise<ExpenseResponse> {
  return apiFetch<ExpenseResponse>(`/api/expenses/${expenseId}/review`, {
    method: 'PATCH',
    body: JSON.stringify({ decision }),
  });
}

/** Marks an approved expense as reimbursed. */
export async function apiReimburseExpense(expenseId: string): Promise<ExpenseResponse> {
  return apiFetch<ExpenseResponse>(`/api/expenses/${expenseId}/reimburse`, { method: 'PATCH' });
}

/** Loads the currency-safe treasurer report computed from source records. */
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

/** Loads the authenticated club dashboard counts from current records. */
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

/** Lists announcements for the authenticated member's club. */
export async function apiListAnnouncements(): Promise<AnnouncementListResponse> {
  return apiFetch<AnnouncementListResponse>('/api/announcements');
}

/** Loads one announcement by identifier. */
export async function apiGetAnnouncement(announcementId: string): Promise<AnnouncementResponse> {
  return apiFetch<AnnouncementResponse>(`/api/announcements/${announcementId}`);
}

/** Publishes a new organizer announcement. */
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

/** Updates an announcement owned by the current organizer. */
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

/** Loads the authenticated club's volunteer task board and live summary. */
export async function apiListTasks(): Promise<TaskBoardResponse> {
  return apiFetch<TaskBoardResponse>('/api/tasks');
}

/** Lists active accounts available for organizer assignment controls. */
export async function apiListAssignableMembers(): Promise<AssignableMembersResponse> {
  return apiFetch<AssignableMembersResponse>('/api/tasks/members');
}

/** Creates a volunteer task as an organizer. */
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

/** Assigns or unassigns a volunteer task as an organizer. */
export async function apiAssignTask(
  taskId: string,
  assigneeId: string | null,
): Promise<TaskResponse> {
  return apiFetch<TaskResponse>(`/api/tasks/${taskId}/assignee`, {
    method: 'PATCH',
    body: JSON.stringify({ assigneeId }),
  });
}

/** Advances volunteer-task progress as its assignee or an organizer. */
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

/** Lists all club merchandise products (any authenticated user). */
export async function apiListProducts(): Promise<ProductListResponse> {
  return apiFetch<ProductListResponse>('/api/store/products');
}

/** Loads one product by id (any authenticated user). */
export async function apiGetProduct(productId: string): Promise<ProductResponse> {
  return apiFetch<ProductResponse>(`/api/store/products/${productId}`);
}

/**
 * Creates a new merchandise product with size variants.
 * Requires officer or admin role (enforced server-side).
 *
 * @param input  Product name, price, currency, and size variants with stock.
 * @returns The created product.
 */
export async function apiCreateProduct(input: {
  name: string;
  priceCents: number;
  currency: string;
  variants: MerchandiseVariant[];
}): Promise<ProductResponse> {
  return apiFetch<ProductResponse>('/api/store/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Updates an existing merchandise product.
 * Requires officer or admin role (enforced server-side).
 *
 * @param productId  The product to update.
 * @param input      Updated name, price, currency, and size variants.
 * @returns The updated product.
 */
export async function apiUpdateProduct(
  productId: string,
  input: {
    name: string;
    priceCents: number;
    currency: string;
    variants: MerchandiseVariant[];
  },
): Promise<ProductResponse> {
  return apiFetch<ProductResponse>(`/api/store/products/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/**
 * Places a one-unit order for a product size.
 *
 * ⚠️  This creates a PENDING_PAYMENT order only. No payment is charged.
 *     Stock is decremented atomically. Payment collection is not yet implemented.
 *
 * @param itemId  The product id.
 * @param size    The size variant to order.
 * @returns The created order (status: pending_payment).
 */
export async function apiPlaceOrder(itemId: string, size: string): Promise<OrderResponse> {
  return apiFetch<OrderResponse>('/api/store/orders', {
    method: 'POST',
    body: JSON.stringify({ itemId, size }),
  });
}

/** Returns the authenticated user's order history newest first. */
export async function apiListMyOrders(): Promise<OrderListResponse> {
  return apiFetch<OrderListResponse>('/api/store/orders/mine');
}
