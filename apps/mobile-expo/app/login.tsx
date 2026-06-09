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
import { applyApiBaseUrl, checkServerHealth, loginApi, getErrorMessage } from '@/services/api';
import { PRODUCTION_API_URL } from '@/config/api';
import { useAuthStore } from '@/store/auth.store';

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('admin@pharmacol.co');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      setChecking(true);
      await applyApiBaseUrl();
      const result = await checkServerHealth();
      setServerOk(result.ok);
      if (!result.ok) {
        setError(result.error ?? 'No se puede conectar al servidor');
      }
      setChecking(false);
    })();
  }, []);

  async function onSubmit() {
    if (!serverOk) {
      setError('Sin conexión al servidor. Verifica tu red e intenta de nuevo.');
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
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={styles.button}
          onPress={onSubmit}
          disabled={loading || checking || !serverOk}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </Pressable>

        {!serverOk && !checking ? (
          <Text style={styles.help}>
            Comprueba tu conexión a internet. El servidor está configurado en la app.
          </Text>
        ) : null}

        {__DEV__ ? (
          <Text style={styles.debug}>API: {PRODUCTION_API_URL}</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginTop: 12 },
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
  },
  button: {
    backgroundColor: '#006874',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#c62828', marginBottom: 8, textAlign: 'center', fontSize: 13 },
  help: { marginTop: 16, fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 18 },
  debug: { marginTop: 16, fontSize: 10, color: '#bbb', textAlign: 'center' },
});
