import { useCallback, useEffect, useState } from 'react';
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
import { applyApiBaseUrl, checkServerHealth, loginApi, getErrorMessage } from '@/services/api';
import { PRODUCTION_API_URL } from '@/config/api';
import { useAuthStore } from '@/store/auth.store';

function friendlyConnectionError(raw?: string): string {
  if (!raw) return 'No se puede conectar al servidor';
  if (/network request failed|certificate|ssl|handshake|trust/i.test(raw)) {
    return 'No se pudo verificar el certificado HTTPS del servidor. Reinstala la APK generada con el certificado incluido.';
  }
  return raw;
}

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('admin@pharmacol.co');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const probeServer = useCallback(async () => {
    setChecking(true);
    setError(null);
    await applyApiBaseUrl();
    const result = await checkServerHealth();
    setServerOk(result.ok);
    if (!result.ok) {
      setError(friendlyConnectionError(result.error));
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    probeServer();
  }, [probeServer]);

  async function onSubmit() {
    if (!serverOk) {
      setError('Sin conexión al servidor. Pulsa Reintentar.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { tokens, user } = await loginApi(email.trim(), password);
      await setSession(user, tokens);
      router.replace('/(tabs)');
    } catch (e) {
      setError(getErrorMessage(e, 'Credenciales inválidas'));
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

        <View style={styles.statusBox}>
          {checking ? (
            <ActivityIndicator size="small" color="#006874" />
          ) : (
            <Text style={[styles.statusText, serverOk ? styles.statusOk : styles.statusFail]}>
              {serverOk ? '● Servidor conectado' : '● Sin conexión al servidor'}
            </Text>
          )}
        </View>

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

        {!serverOk && !checking ? (
          <Pressable style={styles.retryBtn} onPress={probeServer}>
            <Text style={styles.retryText}>Reintentar conexión</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={[styles.button, (!serverOk || loading || checking) && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={loading || checking || !serverOk}
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
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 16 },
  statusBox: { alignItems: 'center', marginBottom: 20 },
  statusText: { fontSize: 14, fontWeight: '600' },
  statusOk: { color: '#2e7d32' },
  statusFail: { color: '#c62828' },
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
  retryBtn: {
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
  },
  retryText: { color: '#006874', fontWeight: '600', fontSize: 14 },
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
