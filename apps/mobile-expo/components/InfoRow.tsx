import { StyleSheet, Text, View } from 'react-native';

interface InfoRowProps {
  label: string;
  value?: string;
  highlight?: boolean;
}

/** Fila label/valor con soporte multilínea y sin desbordamiento */
export function InfoRow({ label, value, highlight }: InfoRowProps) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text
        style={[styles.value, highlight && styles.highlight]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  label: {
    width: 120,
    flexShrink: 0,
    fontWeight: '600',
    color: '#444',
    fontSize: 13,
    lineHeight: 20,
  },
  value: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#222',
  },
  highlight: { color: '#006874', fontWeight: '600' },
});
