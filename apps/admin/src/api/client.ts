import axios, { isAxiosError } from 'axios';

const TOKEN_KEY = 'pharmacol_admin_token';
const REFRESH_KEY = 'pharmacol_admin_refresh';

const baseURL = import.meta.env.VITE_API_URL ?? '/v1';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

const authClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const { data } = await authClient.post('/auth/refresh', { refreshToken });
      const payload = data.data ?? data;
      setToken(payload.accessToken);
      if (payload.refreshToken) {
        localStorage.setItem(REFRESH_KEY, payload.refreshToken);
      }
      return payload.accessToken as string;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function clearToken() {
  clearSession();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export async function login(email: string, password: string) {
  const { data } = await authClient.post('/auth/login', { email, password });
  const payload = data.data ?? data;
  setToken(payload.accessToken);
  if (payload.refreshToken) {
    localStorage.setItem(REFRESH_KEY, payload.refreshToken);
  }
  return payload;
}

export async function logout() {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  try {
    if (refreshToken && getToken()) {
      await api.post('/auth/logout', { refreshToken });
    }
  } catch {
    // ignore
  } finally {
    clearSession();
  }
}

export async function fetchStats() {
  const { data } = await api.get('/admin/dashboard/stats');
  return data.data ?? data;
}

export async function fetchUsers(page = 1) {
  const { data } = await api.get('/admin/users', { params: { page, limit: 20 } });
  return data.data ?? data;
}

export async function fetchAudit(page = 1) {
  const { data } = await api.get('/admin/audit', { params: { page, limit: 50 } });
  return data.data ?? data;
}

export async function fetchSyncHistory(page = 1) {
  const { data } = await api.get('/admin/sync/historial', { params: { page, limit: 20 } });
  return data.data ?? data;
}

export async function triggerSync(fuenteCodigo: string, force = false) {
  const { data } = await api.post(
    '/admin/sync/ejecutar-sync',
    { fuenteCodigo, force },
    { timeout: 3_600_000 },
  );
  return data.data ?? data;
}

export async function fetchFuentes() {
  const { data } = await api.get('/admin/fuentes');
  return data.data ?? data;
}

export async function fetchRoles() {
  const { data } = await api.get('/admin/roles');
  return data.data ?? data;
}

export async function createUser(payload: {
  email: string;
  password: string;
  nombre: string;
  telefono?: string;
  status?: string;
  roleCodigos: string[];
}) {
  const { data } = await api.post('/admin/users', payload);
  return data.data ?? data;
}

export async function updateUser(
  id: string,
  payload: {
    email?: string;
    password?: string;
    nombre?: string;
    telefono?: string;
    status?: string;
    roleCodigos?: string[];
  },
) {
  const { data } = await api.patch(`/admin/users/${id}`, payload);
  return data.data ?? data;
}

export async function deleteUser(id: string) {
  const { data } = await api.delete(`/admin/users/${id}`);
  return data.data ?? data;
}

export async function cancelSyncJob(id: string) {
  const { data } = await api.post(`/admin/sync/${id}/cancelar`);
  return data.data ?? data;
}

export async function deleteSyncJob(id: string) {
  const { data } = await api.delete(`/admin/sync/${id}`);
  return data.data ?? data;
}

export async function searchMedicamentos(
  q: string,
  tipo = 'nombre',
  page = 1,
  limit = 20,
) {
  const { data } = await api.get('/medicamentos/search', {
    params: { q, tipo, page, limit, soloVigentes: true },
  });
  const payload = data.data ?? data;
  return payload as {
    items: Record<string, unknown>[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  };
}

export async function suggestMedicamentos(q: string, limit = 10) {
  const { data } = await api.get('/medicamentos/suggest', { params: { q, limit } });
  const payload = data.data ?? data;
  return payload as {
    items: Record<string, unknown>[];
    relacionados: Record<string, unknown>[];
  };
}

export async function fetchPresentaciones(medicamentoId: string) {
  const { data } = await api.get(`/medicamentos/${medicamentoId}/presentaciones`);
  return (data.data ?? data) as import('../types/medicamentos').PresentacionesResponse;
}

export async function fetchMedicamento(id: string) {
  const { data } = await api.get(`/medicamentos/${id}`);
  return (data.data ?? data) as Record<string, unknown>;
}

export function getErrorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const body = err.response?.data as { error?: string } | undefined;
    if (body?.error) return body.error;
    if (err.response?.status === 401) return 'Sesión expirada — vuelve a iniciar sesión';
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}
