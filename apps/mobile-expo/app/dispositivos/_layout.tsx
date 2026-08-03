import { Stack } from 'expo-router';

export default function DispositivosLayout() {
  return (
    <Stack>
      <Stack.Screen name="[id]" options={{ title: 'Dispositivo médico' }} />
    </Stack>
  );
}
