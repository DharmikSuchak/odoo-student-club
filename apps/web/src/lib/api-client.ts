/**
 * Fetches the API health endpoint and returns the JSON body.
 *
 * Uses the Vite dev-server proxy in development (/api → localhost:3001).
 * In production, VITE_API_BASE_URL provides the absolute base.
 *
 * @throws {Error} If the network request fails or the server returns non-2xx.
 */
export async function fetchApiHealth(): Promise<ApiHealthResponse> {
  const base = import.meta.env['VITE_API_BASE_URL'] ?? '';
  const response = await fetch(`${base}/api/health`);

  if (!response.ok) {
    throw new Error(`API returned ${response.status.toString()} ${response.statusText}`);
  }

  return response.json() as Promise<ApiHealthResponse>;
}

export interface ApiHealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  environment: string;
}
