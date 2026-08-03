import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { syncOfflinePack } from '@/services/pharma.service';
import { getErrorMessage } from '@/services/api';
import { getOfflineStatus } from '@/storage/search-cache';
import { isOnline } from '@/utils/network';

function formatSyncedAt(iso: string | null): string {
  if (!iso) return 'Nunca';
  try {
    return new Date(iso).toLocaleString('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [stale, setStale] = useState(true);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const status = await getOfflineStatus();
    setCount(status.count);
    setSyncedAt(status.syncedAt);
    setStale(status.stale);
  }, []);

  useEffect(() => {
    refreshStatus().catch(() => undefined);
  }, [refreshStatus]);

  async function handleOfflineSync() {
    setSyncing(true);
    setSyncMsg(null);
    setProgress('Comprobando conexión…');
    try {
      if (!(await isOnline())) {
        setSyncMsg('Sin red. Conéctate al Wi‑Fi del servidor e inténtalo de nuevo.');
        return;
      }
      setProgress('Descargando medicamentos…');
      const n = await syncOfflinePack((done, total) => {
        setProgress(`Descargando ${done} / ${total}…`);
      });
      await refreshStatus();
      setSyncMsg(`Listo: ${n} medicamentos guardados en el teléfono.`);
      setProgress(null);
    } catch (e) {
      setSyncMsg(getErrorMessage(e, 'Error al sincronizar paquete offline'));
      setProgress(null);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{user?.nombre ?? '—'}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <View style={styles.roles}>
        {user?.roles.map((r) => (
          <Text key={r} style={styles.chip}>
            {r}
          </Text>
        ))}
      </View>

      <View style={styles.offlineBox}>
        <Text style={styles.offlineTitle}>Modo sin internet</Text>
        <Text style={styles.meta}>Medicamentos en el teléfono: {count}</Text>
        <Text style={styles.meta}>Última sincronización: {formatSyncedAt(syncedAt)}</Text>
        {count === 0 ? (
          <Text style={styles.warn}>
            Aún no hay datos locales. Sincroniza una vez con Wi‑Fi para poder buscar sin red.
          </Text>
        ) : stale ? (
          <Text style={styles.warn}>
            Los datos tienen más de 24 h. Conéctate y actualiza cuando puedas.
          </Text>
        ) : (
          <Text style={styles.ok}>Paquete listo para búsqueda offline.</Text>
        )}

        <Pressable style={styles.syncBtn} onPress={handleOfflineSync} disabled={syncing}>
          {syncing ? (
            <ActivityIndicator color="#006874" />
          ) : (
            <Text style={styles.syncText}>
              {count === 0 ? 'Descargar paquete offline' : 'Actualizar paquete offline'}
            </Text>
          )}
        </Pressable>
        {progress ? <Text style={styles.meta}>{progress}</Text> : null}
        {syncMsg ? <Text style={styles.meta}>{syncMsg}</Text> : null}
      </View>

      <Pressable
        style={styles.logout}
        onPress={async () => {
          await logout();
          router.replace('/login');
        }}
      >
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  name: { fontSize: 24, fontWeight: '700' },
  email: { color: '#666', marginTop: 4 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    backgroundColor: '#e0f2f4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
  },
  offlineBox: {
    marginTop: 28,
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#f5fafb',
    borderWidth: 1,
    borderColor: '#d5e8ec',
  },
  offlineTitle: { fontSize: 17, fontWeight: '700', color: '#006874', marginBottom: 8 },
  syncBtn: {
    marginTop: 14,
    backgroundColor: '#e8f4f6',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  syncText: { color: '#006874', fontWeight: '600' },
  meta: { color: '#666', marginTop: 6, fontSize: 13, lineHeight: 18 },
  warn: { color: '#b26a00', marginTop: 8, fontSize: 13, lineHeight: 18 },
  ok: { color: '#2e7d32', marginTop: 8, fontSize: 13 },
  logout: {
    marginTop: 32,
    backgroundColor: '#ffebee',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#c62828', fontWeight: '600' },
});
