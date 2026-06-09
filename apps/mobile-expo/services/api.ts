import axios, { isAxiosError } from 'axios';
import { getApiUrl, normalizeApiUrl } from '@/config/api';
import { useAuthStore } from '@/store/auth.store';
import { isOnline } from '@/utils/network';
import { getErrorMessage } from '@/utils/errors';
import type { AuthTokens, UserProfile } from '@/types';

export { getErrorMessage };

export const api = axios.create({ timeout: 30000 });
/** Cliente con timeout extendido para OCR (Tesseract puede tardar) */
export const ocrApi = axios.create({ timeout: 120000 });
export const authClient = axios.create({ timeout: 30000 });

let baseUrlReady: Promise<string> | null = null;

export async function applyApiBaseUrl(url?: string): Promise<string> {
  const baseURL = normalizeApiUrl(url ?? (await getApiUrl()));
  api.defaults.baseURL = baseURL;
  ocrApi.defaults.baseURL = baseURL;
  authClient.defaults.baseURL = baseURL;
  return baseURL;
}

export function ensureApiBaseUrl(): Promise<string> {
  if (!baseUrlReady) {
    baseUrlReady = applyApiBaseUrl().finally(() => {
      baseUrlReady = null;
    }) as Promise<string>;
  }
  return baseUrlReady;
}

interface ApiJson<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  baseURL?: string,
): Promise<T> {
  const base = normalizeApiUrl(baseURL ?? (await ensureApiBaseUrl()));
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  let body: ApiJson<T> | null = null;
  try {
    body = (await res.json()) as ApiJson<T>;
  } catch {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }

  if (body && body.success === false) {
    throw new Error(body.error ?? 'Error del servidor');
  }

  return (body?.data ?? body) as T;
}

function isTokenExpired(token: string, bufferSec = 60): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 < Date.now() + bufferSec * 1000;
  } catch {
    return true;
  }
}

let refreshPromise: Promise<boolean> | null = null;

export async function ensureValidSession(): Promise<boolean> {
  const { accessToken, refreshToken } = useAuthStore.getState();
  if (!refreshToken) return !!accessToken;
  if (accessToken && !isTokenExpired(accessToken)) return true;
  if (!(await isOnline())) return !!(accessToken || refreshToken);

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const tokens = await apiFetch<AuthTokens>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: useAuthStore.getState().refreshToken }),
      });
      await useAuthStore.getState().setTokens(tokens);
      return true;
    } catch (err) {
      if (err instanceof Error && err.message.includes('HTTP')) {
        return !!(useAuthStore.getState().accessToken || useAuthStore.getState().refreshToken);
      }
      await useAuthStore.getState().logout();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function isAuthPath(url?: string): boolean {
  return !!url?.includes('/auth/login') || !!url?.includes('/auth/refresh');
}

api.interceptors.request.use(async (config) => {
  await ensureApiBaseUrl();
  if (isAuthPath(config.url)) return config;
  if (await isOnline()) await ensureValidSession();
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry && !isAuthPath(original.url)) {
      original._retry = true;
      if (await ensureValidSession()) {
        original.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  },
);

ocrApi.interceptors.request.use(async (config) => {
  await ensureApiBaseUrl();
  if (isAuthPath(config.url)) return config;
  if (await isOnline()) await ensureValidSession();
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

ocrApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry && !isAuthPath(original.url)) {
      original._retry = true;
      if (await ensureValidSession()) {
        original.headers.Authorization = `Bearer ${useAuthStore.getState().accessToken}`;
        return ocrApi(original);
      }
    }
    return Promise.reject(error);
  },
);

export async function loginApi(
  email: string,
  password: string,
  baseURL?: string,
): Promise<{ tokens: AuthTokens; user: UserProfile }> {
  const base = normalizeApiUrl(baseURL ?? (await applyApiBaseUrl()));

  let tokens: AuthTokens;
  try {
    tokens = await apiFetch<AuthTokens>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      base,
    );
  } catch (e) {
    throw new Error(`Login falló: ${e instanceof Error ? e.message : 'error de red'}`);
  }

  await useAuthStore.getState().setTokens(tokens);

  let user: UserProfile;
  try {
    user = await apiFetch<UserProfile>(
      '/auth/me',
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
      base,
    );
  } catch (e) {
    throw new Error(`Perfil falló: ${e instanceof Error ? e.message : 'error de red'}`);
  }

  return { tokens, user };
}

export async function checkServerHealth(
  baseUrl?: string,
): Promise<{ ok: boolean; url: string; latencyMs?: number; error?: string }> {
  const url = normalizeApiUrl(baseUrl ?? (await applyApiBaseUrl()));
  const healthUrl = `${url}/health`;
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, url, error: `HTTP ${res.status} en ${healthUrl}` };
    }
    const json = (await res.json()) as { success?: boolean };
    if (json.success === false) {
      return { ok: false, url, error: 'Respuesta inesperada del servidor' };
    }
    return { ok: true, url, latencyMs: Date.now() - start };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de red';
    return { ok: false, url, error: `${msg} → ${healthUrl}` };
  }
}
