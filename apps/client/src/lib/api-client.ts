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
  fields?: Record<string, string[]>;
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
    throw data as ApiError;
  }

  return data as T;
}

// ── Auth API calls ───────────────────────────────────────────────────────────

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
