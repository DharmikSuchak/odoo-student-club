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
