// One fetch wrapper for server components (talk to the API directly) and the browser (same-origin /api).

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) {
    super(code);
  }
}

type Init = Omit<RequestInit, 'body'> & { json?: unknown; body?: BodyInit; revalidate?: number };

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const server = typeof window === 'undefined';
  const base = server ? (process.env.API_INTERNAL_URL ?? 'http://localhost:4000') : '';
  const { json, revalidate, headers, ...rest } = init;
  const res = await fetch(base + path, {
    ...rest,
    headers: { ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: 'same-origin',
    ...(server ? (revalidate ? { next: { revalidate } } : { cache: 'no-store' as const }) : {}),
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = (data as { error?: { code?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? `http_${res.status}`, err?.details);
  }
  return data as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;
