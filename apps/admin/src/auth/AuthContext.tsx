import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchMe, getToken } from '../api/client';

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
  isAdmin: boolean;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    setProfile(null);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      clear();
      return;
    }
    setLoading(true);
    try {
      const me = await fetchMe();
      setProfile(me);
    } catch {
      clear();
    } finally {
      setLoading(false);
    }
  }, [clear]);

  useEffect(() => {
    refresh().catch(() => clear());
  }, [refresh, clear]);

  const isAdmin = profile?.roles.includes('ADMINISTRADOR') ?? false;

  const can = useCallback(
    (permission: string) => {
      if (!profile) return false;
      if (isAdmin) return true;
      return profile.permissions.includes(permission);
    },
    [profile, isAdmin],
  );

  const value = useMemo(
    () => ({ profile, loading, refresh, clear, isAdmin, can }),
    [profile, loading, refresh, clear, isAdmin, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

export const NAV_ITEMS = [
  { to: '/consulta', label: 'Consulta', permission: 'medicamentos:read' },
  { to: '/cum-estado', label: 'Estado CUM', permission: 'medicamentos:read' },
  { to: '/alertas', label: 'Alertas INVIMA', permission: 'alertas:view' },
  { to: '/', label: 'Dashboard', permission: 'dashboard:view', end: true },
  { to: '/users', label: 'Usuarios', permission: 'users:manage' },
  { to: '/sync', label: 'Sincronización', permission: 'sync:view' },
  { to: '/actividad', label: 'Actividad de usuarios', permission: 'audit:view' },
] as const;
