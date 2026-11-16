import axios from 'axios';

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, string>;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true,
});

/** Normalizes any thrown error into the backend's { code, message, details } shape. */
export function getApiError(err: unknown): ApiErrorShape {
  const axiosErr = axios.isAxiosError(err) ? err.response?.data as { error?: ApiErrorShape } | undefined : undefined;
  if (axiosErr?.error) return axiosErr.error;
  return { code: 'REQUEST_FAILED', message: err instanceof Error ? err.message : 'Request failed' };
}

/** Builds a query string from a request record, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== false) sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
