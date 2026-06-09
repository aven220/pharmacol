import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getPresentaciones } from '@/services/pharma.service';
import { getErrorMessage } from '@/services/api';
import type { PresentacionItem } from '@/types';

export default function MedicamentoPresentacionesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['medicamento-presentaciones', id],
    queryFn: () => getPresentaciones(id!),
    enabled: !!id,
  });

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color="#006874" />;
  if (error || !data) return <Text style={styles.error}>{getErrorMessage(error)}</Text>;

  const { medicamento, presentaciones, total } = data;

  function openFicha(pres: PresentacionItem) {
    router.push({
      pathname: '/medicamentos/[id]/ficha',
      params: { id: id!, cumId: pres.id, cum: pres.cum ?? '' },
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>PRESENTACIONES DISPONIBLES</Text>
      <Text style={styles.title} numberOfLines={4}>
        {medicamento.nombreComercial}
      </Text>
      {medicamento.concentracion ? (
        <Text style={styles.meta} numberOfLines={2}>
          {medicamento.concentracion}
          {medicamento.formaFarmaceutica ? ` · ${medicamento.formaFarmaceutica}` : ''}
        </Text>
      ) : null}
      <Text style={styles.subtitle}>
        {total} presentación{total === 1 ? '' : 'es'} encontrada{total === 1 ? '' : 's'}
      </Text>

      <FlatList
        data={presentaciones}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => openFicha(item)}>
            <Text style={styles.etiqueta} numberOfLines={3}>
              {item.etiquetaPresentacion ?? item.presentacionComercial ?? item.embalaje}
            </Text>

            {item.embalaje &&
            item.etiquetaPresentacion &&
            !item.etiquetaPresentacion.includes(item.embalaje) ? (
              <Text style={styles.embalajeSecundario} numberOfLines={2}>
                {item.embalaje}
              </Text>
            ) : null}

            {item.descripcionProducto ? (
              <Text style={styles.descripcion} numberOfLines={6}>
                {item.descripcionProducto}
              </Text>
            ) : null}

            {item.laboratorio ?? medicamento.laboratorio ? (
              <Text style={styles.laboratorio} numberOfLines={2}>
                {item.laboratorio ?? medicamento.laboratorio}
              </Text>
            ) : null}

            <Text style={styles.verDetalle}>Ver ficha completa →</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#006874',
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  meta: { color: '#555', fontSize: 14, marginTop: 4, lineHeight: 20 },
  subtitle: { color: '#666', marginTop: 8, marginBottom: 16, fontSize: 15 },
  card: {
    padding: 14,
    backgroundColor: '#f5f8f9',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0eef0',
    overflow: 'hidden',
  },
  etiqueta: {
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
    color: '#006874',
    marginBottom: 8,
  },
  embalajeSecundario: { color: '#333', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  descripcion: {
    color: '#555',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  laboratorio: { color: '#666', fontSize: 13, marginTop: 4, lineHeight: 18 },
  verDetalle: { marginTop: 10, color: '#006874', fontWeight: '600', fontSize: 13 },
  error: { color: '#c62828', padding: 16 },
});
