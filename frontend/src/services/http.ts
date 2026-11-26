/**
 * HTTP client for LIVE mode (Phase 4+ backend). Mock mode bypasses this.
 * Error handling normalises RFC 9457 problem+json into ApiError (types/index.ts).
 */
import { ApiError, type ProblemDetail } from '@/types';

const ACCESS_KEY = 'hotspot_access_token';
const REFRESH_KEY = 'hotspot_refresh_token';

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAuthTokens(access: string, refresh: string): void {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const { method = 'GET', body, token } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = token === undefined ? getAccessToken() : token;
  if (auth) headers.Authorization = `Bearer ${auth}`;

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError({
      type: 'about:blank',
      title: 'Network unavailable',
      status: 0,
      detail: 'Could not reach the server. Check your connection and try again.',
    });
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  // A26 returns text/csv, not JSON — JSON.parse would silently yield null and
  // download an empty file in live mode. Keep the raw body for CSV responses.
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return text as T;
  }

  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const problem: ProblemDetail =
      payload && typeof payload === 'object' && 'title' in payload
        ? (payload as ProblemDetail)
        : {
            type: 'about:blank',
            title: res.statusText || 'Request failed',
            status: res.status,
          };
    throw new ApiError(problem);
  }
  return payload as T;
}
