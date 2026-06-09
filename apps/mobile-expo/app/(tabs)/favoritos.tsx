import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { listFavoritos, removeFavorito } from '@/services/pharma.service';
import { getErrorMessage } from '@/services/api';

export default function FavoritosScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['favoritos'],
    queryFn: listFavoritos,
  });

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color="#006874" />;
  if (error) return <Text style={styles.error}>{getErrorMessage(error)}</Text>;

  return (
    <FlatList
      style={styles.container}
      data={data ?? []}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 16 }}
      ListEmptyComponent={<Text style={styles.empty}>No tienes favoritos</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Pressable
            onPress={() => {
              if (item.entidadTipo === 'MEDICAMENTO') {
                router.push(`/medicamentos/${item.entidadId}`);
              }
            }}
          >
            <Text style={styles.title}>{String(item.entidadTipo)}</Text>
            <Text style={styles.meta}>{String(item.entidadId).slice(0, 8)}…</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              await removeFavorito(String(item.id));
              qc.invalidateQueries({ queryKey: ['favoritos'] });
            }}
          >
            <Text style={styles.remove}>Eliminar</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  card: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, backgroundColor: '#f5f5f5', borderRadius: 12, marginBottom: 8 },
  title: { fontWeight: '600' },
  meta: { color: '#666', fontSize: 13 },
  remove: { color: '#c62828' },
  empty: { textAlign: 'center', color: '#666', marginTop: 40 },
  error: { color: '#c62828', padding: 16 },
});
