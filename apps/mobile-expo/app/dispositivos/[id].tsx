import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { getDispositivo } from '@/services/pharma.service';
import { getErrorMessage } from '@/services/api';

export default function DispositivoDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['dispositivo', id],
    queryFn: () => getDispositivo(id!),
    enabled: !!id,
  });

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color="#006874" />;
  if (error || !data) {
    return <Text style={styles.error}>{getErrorMessage(error, 'No se pudo cargar')}</Text>;
  }

  const registro = data.registroInvima as Record<string, unknown> | undefined;
  const fabricante = data.fabricante as Record<string, unknown> | undefined;
  const importador = data.importador as Record<string, unknown> | undefined;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{String(data.nombre ?? 'Dispositivo')}</Text>
      {registro?.numeroRegistro ? (
        <Text style={styles.meta}>{String(registro.numeroRegistro)}</Text>
      ) : null}
      {data.estadoRegistro ? (
        <Text style={styles.meta}>Estado: {String(data.estadoRegistro)}</Text>
      ) : null}
      {data.categoria ? (
        <Text style={styles.meta}>Categoría: {String(data.categoria)}</Text>
      ) : null}
      {data.claseRiesgo ? (
        <Text style={styles.meta}>Clase de riesgo: {String(data.claseRiesgo)}</Text>
      ) : null}
      {fabricante?.razonSocial ? (
        <Text style={styles.meta}>Fabricante / titular: {String(fabricante.razonSocial)}</Text>
      ) : null}
      {importador?.razonSocial ? (
        <Text style={styles.meta}>Importador: {String(importador.razonSocial)}</Text>
      ) : null}
      {data.descripcion ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Descripción</Text>
          <Text style={styles.body}>{String(data.descripcion)}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  meta: { color: '#555', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  block: { marginTop: 16, padding: 14, backgroundColor: '#f5f8f9', borderRadius: 12 },
  blockTitle: { fontWeight: '700', color: '#006874', marginBottom: 8 },
  body: { color: '#333', fontSize: 14, lineHeight: 20 },
  error: { color: '#c62828', padding: 16 },
});
