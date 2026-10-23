import type { Meta } from './types';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  status: number;
  fields: Record<string, string[]>;
  constructor(status: number, message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

interface Opts { method?: string; body?: unknown; form?: FormData }

async function request<T>(path: string, o: Opts = {}): Promise<{ data: T; meta?: Meta }> {
  const init: RequestInit = { method: o.method ?? (o.body || o.form ? 'POST' : 'GET'), credentials: 'include' };
  if (o.form) init.body = o.form;
  else if (o.body !== undefined) {
    init.body = JSON.stringify(o.body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || !json?.success) {
    const d = json?.error?.details;
    throw new ApiError(res.status, json?.error?.message ?? 'Something went wrong', d && typeof d === 'object' ? d : {});
  }
  return { data: json.data as T, meta: json.meta };
}

export const api = {
  get: async <T,>(p: string) => (await request<T>(p)).data,
  list: <T,>(p: string) => request<T[]>(p),
  post: async <T,>(p: string, body?: unknown) => (await request<T>(p, { method: 'POST', body: body ?? {} })).data,
  put: async <T,>(p: string, body?: unknown) => (await request<T>(p, { method: 'PUT', body: body ?? {} })).data,
  patch: async <T,>(p: string, body?: unknown) => (await request<T>(p, { method: 'PATCH', body: body ?? {} })).data,
  del: async <T,>(p: string, body?: unknown) => (await request<T>(p, { method: 'DELETE', body })).data,
  upload: async <T,>(p: string, form: FormData) => (await request<T>(p, { method: 'POST', form })).data,
};

export const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  Object.entries(o).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : '';
};
