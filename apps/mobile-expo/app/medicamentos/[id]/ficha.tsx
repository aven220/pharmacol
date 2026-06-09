import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { InfoRow } from '@/components/InfoRow';
import { addFavorito, getMedicamento } from '@/services/pharma.service';
import { getErrorMessage } from '@/services/api';
import { buildPresentaciones, mapMedicamentoDetail, type PresentacionItem } from '@/types';

export default function MedicamentoFichaScreen() {
  const { id, cumId, cum } = useLocalSearchParams<{ id: string; cumId?: string; cum?: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['medicamento', id],
    queryFn: () => getMedicamento(id!),
    enabled: !!id,
  });

  if (isLoading) return <ActivityIndicator style={{ flex: 1 }} color="#006874" />;
  if (error || !data) return <Text style={styles.error}>{getErrorMessage(error)}</Text>;

  const detail = mapMedicamentoDetail(data);
  const presentacion = resolvePresentacion(detail.presentaciones, cumId, cum);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Presentaciones</Text>
      </Pressable>

      <Text style={styles.title} numberOfLines={4}>{detail.nombreComercial}</Text>
      {presentacion?.presentacionComercial &&
      presentacion.presentacionComercial !== detail.nombreComercial ? (
        <Text style={styles.subtitle} numberOfLines={3}>{presentacion.presentacionComercial}</Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Identificación</Text>
        <InfoRow label="Registro INVIMA" value={presentacion?.numeroRegistro ?? detail.numeroRegistro} />
        <InfoRow label="CUM" value={presentacion?.cum} highlight />
        <InfoRow label="Estado registro" value={presentacion?.estadoRegistro ?? detail.estadoRegistro} />
        <InfoRow label="Estado CUM" value={presentacion?.estadoCum} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Presentación</Text>
        <InfoRow label="Presentación comercial" value={presentacion?.embalaje ?? presentacion?.presentacionComercial} highlight />
        <InfoRow label="Descripción comercial" value={presentacion?.descripcionProducto} />
        <InfoRow label="Concentración" value={presentacion?.concentracion ?? detail.concentracion} />
        <InfoRow label="Forma farmacéutica" value={presentacion?.formaFarmaceutica ?? detail.formaFarmaceutica} />
        <InfoRow
          label="Cantidad"
          value={
            presentacion?.cantidad
              ? `${presentacion.cantidad}${presentacion.unidad ? ` ${presentacion.unidad}` : ''}`
              : undefined
          }
        />
        <InfoRow label="Código barras" value={presentacion?.codigoBarras} />
        <InfoRow label="Vía administración" value={detail.viaAdministracion} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Titular / Laboratorio</Text>
        <InfoRow label="Laboratorio" value={detail.laboratorio} />
        <InfoRow label="Titular" value={detail.titular} />
      </View>

      {detail.principiosActivos.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Principios activos</Text>
          {detail.principiosActivos.map((p, i) => (
            <Text key={i} style={styles.bullet} numberOfLines={4}>• {p}</Text>
          ))}
        </View>
      ) : null}

      {detail.indicaciones ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicaciones</Text>
          <Text style={styles.bodyText}>{detail.indicaciones}</Text>
        </View>
      ) : null}

      {detail.contraindicaciones ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contraindicaciones</Text>
          <Text style={styles.bodyText}>{detail.contraindicaciones}</Text>
        </View>
      ) : null}

      <Pressable
        style={styles.fav}
        onPress={async () => {
          await addFavorito('MEDICAMENTO', id!);
          qc.invalidateQueries({ queryKey: ['favoritos'] });
        }}
      >
        <Text style={styles.favText}>Agregar a favoritos</Text>
      </Pressable>
    </ScrollView>
  );
}

function resolvePresentacion(
  items: PresentacionItem[],
  cumId?: string,
  cum?: string,
): PresentacionItem | undefined {
  if (cumId) {
    const byId = items.find((p) => p.id === cumId);
    if (byId) return byId;
  }
  if (cum) {
    const byCum = items.find((p) => p.cum?.toLowerCase() === cum.toLowerCase());
    if (byCum) return byCum;
  }
  return items[0];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  back: { color: '#006874', marginBottom: 12, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4, lineHeight: 28 },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 12, lineHeight: 22 },
  section: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  sectionTitle: { fontWeight: '700', marginBottom: 8, color: '#006874' },
  bullet: { marginBottom: 4, lineHeight: 20 },
  bodyText: { lineHeight: 20 },
  fav: { backgroundColor: '#006874', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 24, marginBottom: 32 },
  favText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c62828', padding: 16 },
});
