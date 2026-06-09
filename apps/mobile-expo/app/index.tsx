import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/auth.store';

export default function Index() {
  const token = useAuthStore((s) => s.accessToken);
  return <Redirect href={token ? '/(tabs)' : '/login'} />;
}
