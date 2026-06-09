import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MedicamentoSuggest, MedicamentoSummary } from '@/types';

type Item = MedicamentoSummary | MedicamentoSuggest;

interface MedicamentoCardProps {
  item: Item;
  highlight?: boolean;
  onPress: () => void;
}

/** Tarjeta de medicamento con textos multilínea y sin superposición */
export function MedicamentoCard({ item, highlight, onPress }: MedicamentoCardProps) {
  const score =
    'score' in item && item.score ? `${Math.round(item.score * 100)}%` : null;

  return (
    <Pressable
      style={[styles.card, highlight && styles.cardHighlight]}
      onPress={onPress}
    >
      <Text style={styles.title} numberOfLines={3}>
        {item.nombreComercial}
      </Text>

      {item.concentracion ? (
        <Text style={styles.meta} numberOfLines={2}>
          {item.concentracion}
        </Text>
      ) : null}
      {item.formaFarmaceutica ? (
        <Text style={styles.meta} numberOfLines={2}>
          {item.formaFarmaceutica}
        </Text>
      ) : null}
      {item.numeroRegistro ? (
        <Text style={styles.meta} numberOfLines={2}>
          {item.numeroRegistro}
        </Text>
      ) : null}
      {item.laboratorio ? (
        <Text style={styles.meta} numberOfLines={3}>
          {item.laboratorio}
        </Text>
      ) : null}
      {'numPresentaciones' in item && item.numPresentaciones ? (
        <Text style={styles.presentaciones} numberOfLines={1}>
          {item.numPresentaciones} presentación{item.numPresentaciones === 1 ? '' : 'es'}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.badge} numberOfLines={1}>
          {item.estadoRegistro ?? '—'}
        </Text>
        {score ? (
          <Text style={styles.score} numberOfLines={1}>
            {score} coincidencia
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardHighlight: {
    backgroundColor: '#e8f4f6',
    borderWidth: 1,
    borderColor: '#b2dfe5',
  },
  title: {
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    color: '#111',
  },
  meta: {
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  presentaciones: {
    color: '#006874',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  badge: {
    fontSize: 12,
    color: '#006874',
    fontWeight: '600',
    flexShrink: 1,
  },
  score: {
    fontSize: 11,
    color: '#888',
    flexShrink: 0,
  },
});
