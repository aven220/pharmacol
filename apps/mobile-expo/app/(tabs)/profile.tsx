import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';
import { syncOfflinePack } from '@/services/pharma.service';
import { getErrorMessage } from '@/services/api';
import { getOfflinePackCount } from '@/storage/search-cache';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [syncing, setSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState<number | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function handleOfflineSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const count = await syncOfflinePack();
      setOfflineCount(count);
      setSyncMsg(`Paquete offline actualizado: ${count} medicamentos`);
    } catch (e) {
      setSyncMsg(getErrorMessage(e, 'Error al sincronizar paquete offline'));
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
          <Text key={r} style={styles.chip}>{r}</Text>
        ))}
      </View>

      <Pressable style={styles.syncBtn} onPress={handleOfflineSync} disabled={syncing}>
        {syncing ? (
          <ActivityIndicator color="#006874" />
        ) : (
          <Text style={styles.syncText}>Sincronizar paquete offline</Text>
        )}
      </Pressable>
      {offlineCount !== null ? (
        <Text style={styles.meta}>En caché local: {offlineCount} registros</Text>
      ) : null}
      {syncMsg ? <Text style={styles.meta}>{syncMsg}</Text> : null}

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
  chip: { backgroundColor: '#e0f2f4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12 },
  syncBtn: { marginTop: 24, backgroundColor: '#e8f4f6', padding: 14, borderRadius: 12, alignItems: 'center' },
  syncText: { color: '#006874', fontWeight: '600' },
  meta: { color: '#666', marginTop: 8, fontSize: 13 },
  logout: { marginTop: 32, backgroundColor: '#ffebee', padding: 14, borderRadius: 12, alignItems: 'center' },
  logoutText: { color: '#c62828', fontWeight: '600' },
});
