import { publicEnvironment } from '../config/environment';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey =
    typeof window === 'undefined' ? null : window.sessionStorage.getItem('seekr_api_key');
  const response = await fetch(`${publicEnvironment.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(apiKey === null ? {} : { authorization: `Bearer ${apiKey}` }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(
      response.status,
      body.message ?? `Request failed with HTTP ${response.status}`,
      body.code,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function setSessionApiKey(value: string | null): void {
  if (value === null) window.sessionStorage.removeItem('seekr_api_key');
  else window.sessionStorage.setItem('seekr_api_key', value);
}

export function apiUrl(path: string): string {
  return `${publicEnvironment.NEXT_PUBLIC_API_URL}${path}`;
}

export async function trackSearchClick(
  searchId: string,
  documentId: string,
  position: number,
): Promise<void> {
  await apiRequest('/v1/events/click', {
    method: 'POST',
    body: JSON.stringify({ searchId, documentId, position }),
  });
}
