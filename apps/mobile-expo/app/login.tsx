import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { applyApiBaseUrl, loginApi, getErrorMessage } from '@/services/api';
import { getApiUrl } from '@/config/api';
import { useAuthStore } from '@/store/auth.store';

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('admin@pharmacol.co');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    applyApiBaseUrl().catch(() => undefined);
  }, []);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await applyApiBaseUrl();
      const { tokens, user } = await loginApi(email.trim(), password);
      await setSession(user, tokens);
      router.replace('/(tabs)');
    } catch (e) {
      setError(getErrorMessage(e, 'No se pudo iniciar sesión. Verifica red Wi‑Fi y credenciales.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Ionicons name="medical" size={64} color="#006874" />
        <Text style={styles.title}>PharmaCol</Text>
        <Text style={styles.subtitle}>Consulta farmacéutica INVIMA</Text>
        <Text style={styles.apiHint}>{getApiUrl()}</Text>

        <TextInput
          style={styles.input}
          placeholder="Correo"
          placeholderTextColor="#888"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#888"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginTop: 12, color: '#111' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 8 },
  apiHint: {
    textAlign: 'center',
    color: '#999',
    fontSize: 11,
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#006874',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#c62828', marginBottom: 8, textAlign: 'center', fontSize: 13 },
});
