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
import { searchMedicamentos, suggestMedicamentos } from '@/services/pharma.service';
import { getErrorMessage } from '@/services/api';
import { isOnline } from '@/utils/network';
import type { MedicamentoSuggest, MedicamentoSummary } from '@/types';

const MIN_CHARS = 2;

const TIPO_LABELS: Record<string, string> = {
  nombre: 'Nombre',
  registro: 'INVIMA',
  cum: 'CUM',
  principio_activo: 'Principio activo',
};

const TIPO_PLACEHOLDERS: Record<string, string> = {
  nombre: 'Ej: Acetaminofén, Amoxicilina...',
  registro: 'Ej: INVIMA 2023M-0012728-R2',
  cum: 'Ej: 20031822-1',
  principio_activo: 'Ej: Paracetamol, Ibuprofeno...',
};

export default function SearchScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [tipo, setTipo] = useState('nombre');
  const [offline, setOffline] = useState(false);
  const debouncedQuery = useDebouncedValue(input.trim(), 350);
  const isLiveSearch = input.trim().length >= MIN_CHARS;

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
    enabled: isLiveSearch && tipo === 'nombre',
    staleTime: 15_000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['medicamentos', debouncedQuery, tipo],
    queryFn: async () => {
      setOffline(!(await isOnline()));
      return searchMedicamentos(debouncedQuery, tipo);
    },
    enabled: isLiveSearch,
    staleTime: 15_000,
  });

  const showSuggestions =
    isLiveSearch && tipo === 'nombre' && (suggestions?.items.length ?? 0) > 0;
  const showResults = isLiveSearch && (data?.items.length ?? 0) > 0;
  const showEmpty = isLiveSearch && !isLoading && !loadingSuggest && !showResults && !error;

  function navigateToMedicamento(item: MedicamentoSummary | MedicamentoSuggest) {
    router.push(`/medicamentos/${item.id}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Consulta farmacéutica</Text>
      {offline ? <Text style={styles.offline}>Modo offline — caché local</Text> : null}

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder={TIPO_PLACEHOLDERS[tipo] ?? 'Escriba para buscar...'}
          value={input}
          onChangeText={setInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {(isLoading || loadingSuggest) && isLiveSearch ? (
          <ActivityIndicator style={styles.inputSpinner} color="#006874" size="small" />
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chips}
      >
        {Object.entries(TIPO_LABELS).map(([t, label]) => (
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

      {error ? <Text style={styles.error}>{getErrorMessage(error)}</Text> : null}

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

        {showResults ? (
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
});
