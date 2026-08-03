import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { MedicamentoCard } from '@/components/MedicamentoCard';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  searchDispositivos,
  searchMedicamentos,
  suggestMedicamentos,
  type DispositivoSummary,
} from '@/services/pharma.service';
import { getErrorMessage } from '@/services/api';
import { isOnline } from '@/utils/network';
import type { MedicamentoSuggest, MedicamentoSummary } from '@/types';

const MIN_CHARS = 2;

type Catalogo = 'medicamentos' | 'dispositivos';

const MED_TIPO_LABELS: Record<string, string> = {
  nombre: 'Nombre',
  registro: 'INVIMA',
  cum: 'CUM',
  principio_activo: 'Principio activo',
};

const DM_TIPO_LABELS: Record<string, string> = {
  nombre: 'Nombre',
  registro: 'INVIMA',
};

const TIPO_PLACEHOLDERS: Record<string, string> = {
  nombre: 'Ej: Acetaminofén, Amoxicilina...',
  registro: 'Ej: INVIMA 2023M-0012728-R2',
  cum: 'Ej: 20031822-1',
  principio_activo: 'Ej: Paracetamol, Ibuprofeno...',
};

export default function SearchScreen() {
  const router = useRouter();
  const [catalogo, setCatalogo] = useState<Catalogo>('medicamentos');
  const [input, setInput] = useState('');
  const [tipo, setTipo] = useState('nombre');
  const [offline, setOffline] = useState(false);
  const debouncedQuery = useDebouncedValue(input.trim(), 350);
  const isLiveSearch = input.trim().length >= MIN_CHARS;
  const tipoLabels = catalogo === 'dispositivos' ? DM_TIPO_LABELS : MED_TIPO_LABELS;

  function selectCatalogo(next: Catalogo) {
    if (next === catalogo) return;
    setCatalogo(next);
    setTipo('nombre');
    setInput('');
  }

  function selectTipo(next: string) {
    if (next === tipo) return;
    setTipo(next);
    setInput('');
  }

  const { data: suggestions, isFetching: loadingSuggest } = useQuery({
    queryKey: ['medicamentos-suggest', debouncedQuery],
    queryFn: async () => {
      setOffline(!(await isOnline()));
      return suggestMedicamentos(debouncedQuery);
    },
    enabled: catalogo === 'medicamentos' && isLiveSearch && tipo === 'nombre',
    staleTime: 15_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['medicamentos', debouncedQuery, tipo],
    queryFn: async () => {
      setOffline(!(await isOnline()));
      return searchMedicamentos(debouncedQuery, tipo);
    },
    enabled: catalogo === 'medicamentos' && isLiveSearch,
    staleTime: 15_000,
  });

  const {
    data: dmData,
    isLoading: dmLoading,
    error: dmError,
  } = useQuery({
    queryKey: ['dispositivos', debouncedQuery, tipo],
    queryFn: async () => {
      setOffline(!(await isOnline()));
      if (!(await isOnline())) {
        throw new Error('Dispositivos médicos requieren conexión al servidor.');
      }
      return searchDispositivos(debouncedQuery, tipo === 'registro' ? 'registro' : 'nombre');
    },
    enabled: catalogo === 'dispositivos' && isLiveSearch,
    staleTime: 15_000,
  });

  const showSuggestions =
    catalogo === 'medicamentos' &&
    isLiveSearch &&
    tipo === 'nombre' &&
    (suggestions?.items.length ?? 0) > 0;
  const showMedResults =
    catalogo === 'medicamentos' && isLiveSearch && (data?.items.length ?? 0) > 0;
  const showDmResults =
    catalogo === 'dispositivos' && isLiveSearch && (dmData?.items.length ?? 0) > 0;
  const loading = catalogo === 'medicamentos' ? isLoading || loadingSuggest : dmLoading;
  const activeError = catalogo === 'medicamentos' ? error : dmError;
  const showEmpty =
    isLiveSearch &&
    !loading &&
    !activeError &&
    !showMedResults &&
    !showDmResults &&
    !showSuggestions;

  function navigateToMedicamento(item: MedicamentoSummary | MedicamentoSuggest) {
    router.push(`/medicamentos/${item.id}`);
  }

  function navigateToDispositivo(item: DispositivoSummary) {
    router.push(`/dispositivos/${item.id}` as never);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Consulta farmacéutica</Text>
      {offline ? (
        <Text style={styles.offline}>
          Sin red — buscando en el paquete guardado en el teléfono
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catalogScroll}
        contentContainerStyle={styles.chips}
      >
        {(
          [
            ['medicamentos', 'Medicamentos'],
            ['dispositivos', 'Dispositivos'],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            style={[styles.chip, catalogo === id && styles.chipActive]}
            onPress={() => selectCatalogo(id)}
          >
            <Text style={[styles.chipText, catalogo === id && styles.chipTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={
            catalogo === 'dispositivos'
              ? tipo === 'registro'
                ? 'Ej: INVIMA 2018DM-000456-R1'
                : 'Ej: Catéter, glucometro, stent...'
              : (TIPO_PLACEHOLDERS[tipo] ?? 'Escriba para buscar...')
          }
          value={input}
          onChangeText={setInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {loading && isLiveSearch ? (
          <ActivityIndicator style={styles.inputSpinner} color="#006874" size="small" />
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        {Object.entries(tipoLabels).map(([t, label]) => (
          <Pressable
            key={t}
            style={[styles.chip, tipo === t && styles.chipActive]}
            onPress={() => selectTipo(t)}
          >
            <Text style={[styles.chipText, tipo === t && styles.chipTextActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {input.length > 0 && input.trim().length < MIN_CHARS ? (
        <Text style={styles.hint}>Escriba al menos {MIN_CHARS} caracteres...</Text>
      ) : null}

      {activeError ? <Text style={styles.error}>{getErrorMessage(activeError)}</Text> : null}

      <ScrollView style={styles.resultsScroll} keyboardShouldPersistTaps="handled">
        {showSuggestions ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sugerencias</Text>
            {suggestions!.items.map((item) => (
              <MedicamentoCard
                key={`s-${item.id}`}
                item={item}
                highlight
                onPress={() => navigateToMedicamento(item)}
              />
            ))}
          </View>
        ) : null}

        {showMedResults ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resultados ({data!.meta.total})</Text>
            {data!.items.map((item) => (
              <MedicamentoCard
                key={item.id}
                item={item}
                onPress={() => navigateToMedicamento(item)}
              />
            ))}
            {suggestions?.relacionados?.length ? (
              <View style={styles.related}>
                <Text style={styles.sectionTitle}>Medicamentos relacionados</Text>
                {suggestions.relacionados.map((r) => (
                  <MedicamentoCard
                    key={`r-${r.id}`}
                    item={r}
                    onPress={() => navigateToMedicamento(r)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {showDmResults ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resultados ({dmData!.meta.total})</Text>
            {dmData!.items.map((item) => (
              <Pressable
                key={item.id}
                style={styles.dmCard}
                onPress={() => navigateToDispositivo(item)}
              >
                <Text style={styles.dmTitle} numberOfLines={3}>
                  {item.nombre}
                </Text>
                {item.numeroRegistro ? (
                  <Text style={styles.dmMeta} numberOfLines={2}>
                    {item.numeroRegistro}
                  </Text>
                ) : null}
                {item.categoria ? (
                  <Text style={styles.dmMeta} numberOfLines={2}>
                    {item.categoria}
                  </Text>
                ) : null}
                {item.fabricante ? (
                  <Text style={styles.dmMeta} numberOfLines={2}>
                    {item.fabricante}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}

        {showEmpty ? (
          <Text style={styles.empty}>Sin resultados para "{debouncedQuery}"</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  offline: { color: '#e65100', marginBottom: 8 },
  catalogScroll: { maxHeight: 44, marginBottom: 8 },
  inputWrap: { position: 'relative' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    paddingRight: 40,
    fontSize: 16,
  },
  inputSpinner: { position: 'absolute', right: 12, top: 14 },
  hint: { color: '#888', fontSize: 13, marginTop: 8 },
  chipsScroll: { maxHeight: 44, marginVertical: 12 },
  chips: { flexDirection: 'row', gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#eee' },
  chipActive: { backgroundColor: '#006874' },
  chipText: { fontSize: 12, color: '#333' },
  chipTextActive: { color: '#fff' },
  resultsScroll: { flex: 1 },
  section: { marginTop: 8, paddingBottom: 16 },
  sectionTitle: { fontWeight: '700', fontSize: 15, marginBottom: 8, color: '#006874' },
  related: { marginTop: 16 },
  error: { color: '#c62828', marginTop: 12 },
  empty: { textAlign: 'center', color: '#666', marginTop: 24 },
  dmCard: {
    padding: 14,
    backgroundColor: '#f5f8f9',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0eef0',
  },
  dmTitle: { fontWeight: '700', fontSize: 16, color: '#111', marginBottom: 4 },
  dmMeta: { color: '#555', fontSize: 13, lineHeight: 18 },
});
