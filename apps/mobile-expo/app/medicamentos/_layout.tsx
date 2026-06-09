import { Stack } from 'expo-router';

export default function MedicamentosLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]/index" options={{ title: 'Presentaciones disponibles' }} />
      <Stack.Screen name="[id]/ficha" options={{ title: 'Ficha del producto' }} />
    </Stack>
  );
}
