import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '@/store/auth.store';
import { syncOfflinePackIfNeeded } from '@/services/pharma.service';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { accessToken, isLoading, loadStoredAuth } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const autoSyncDone = useRef(false);

  useEffect(() => {
    loadStoredAuth();
  }, [loadStoredAuth]);

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === 'login';
    if (!accessToken && !inAuth) router.replace('/login');
    else if (accessToken && inAuth) router.replace('/(tabs)');
  }, [accessToken, isLoading, segments, router]);

  useEffect(() => {
    if (isLoading || !accessToken || autoSyncDone.current) return;
    autoSyncDone.current = true;
    syncOfflinePackIfNeeded(24).catch(() => undefined);
  }, [accessToken, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#006874" />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="medicamentos" options={{ headerShown: false }} />
        </Stack>
      </AuthGuard>
    </QueryClientProvider>
  );
}
