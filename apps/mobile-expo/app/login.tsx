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
import {
  applyApiBaseUrl,
  checkServerHealth,
  loginApi,
  getErrorMessage,
} from '@/services/api';
import Constants from 'expo-constants';
import { useAuthStore } from '@/store/auth.store';

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('admin@pharmacol.co');
  const [password, setPassword] = useState('admin123');
  const [apiUrlInput, setApiUrlInput] = useState(API_URL_HINT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  const isExpoGo = Constants.appOwnership === 'expo';

  async function testConnection(urlOverride?: string) {
    setChecking(true);
    setError(null);
    const url = normalizeApiUrl(urlOverride ?? apiUrlInput);
    setApiUrlInput(url);
    await setApiUrlOverride(url);
    await applyApiBaseUrl(url);
    const result = await checkServerHealth(url);
    setServerOk(result.ok);
    if (!result.ok) {
      const sslHint =
        /network request failed|certificate|ssl|handshake|trust/i.test(result.error ?? '')
          ? '\n\nEl servidor usa HTTPS autofirmado. Expo Go no puede conectar — instala la app nativa (ver ayuda abajo).'
          : '';
      setError((result.error ?? 'No se puede conectar al backend') + sslHint);
    }
    setChecking(false);
  }

  useEffect(() => {
    (async () => {
      const saved = await getApiUrlOverride();
      const url = saved ?? (await getApiUrl());
      setApiUrlInput(url);
      setDebugInfo(getExpoDebugInfo());
      await testConnection(url);
    })();
  }, []);

  async function onSubmit() {
    if (!serverOk) {
      setError('Primero pulsa "Probar" y verifica conexión verde');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = normalizeApiUrl(apiUrlInput);
      await setApiUrlOverride(url);
      await applyApiBaseUrl(url);
      const { tokens, user } = await loginApi(email.trim(), password, url);
      await setSession(user, tokens);
      router.replace('/(tabs)');
    } catch (e) {
      setError(getErrorMessage(e, 'Credenciales inválidas'));
    } finally {
      setLoading(false);
    }
  }

  async function resetUrl() {
    await setApiUrlOverride(null);
    const url = PRODUCTION_API_URL;
    setApiUrlInput(url);
    await testConnection(url);
  }

  function useProductionUrl() {
    setApiUrlInput(PRODUCTION_API_URL);
    testConnection(PRODUCTION_API_URL);
  }

  function useAutoIp() {
    const host = getExpoDevHost();
    if (host) {
      const url = normalizeApiUrl(`http://${host}:3005`);
      setApiUrlInput(url);
      testConnection(url);
    } else {
      setError(`No se detectó IP de Expo. Usa: ${PRODUCTION_API_URL}`);
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

        <Text style={styles.label}>URL del servidor (editable)</Text>
        <TextInput
          style={styles.input}
          value={apiUrlInput}
          onChangeText={setApiUrlInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={PRODUCTION_API_URL}
        />
        <View style={styles.row}>
          <Pressable style={styles.smallBtn} onPress={() => testConnection()}>
            <Text style={styles.smallBtnText}>Probar</Text>
          </Pressable>
          <Pressable style={styles.smallBtn} onPress={useAutoIp}>
            <Text style={styles.smallBtnText}>Auto IP</Text>
          </Pressable>
          <Pressable style={styles.smallBtn} onPress={useProductionUrl}>
            <Text style={styles.smallBtnText}>Producción</Text>
          </Pressable>
          <Pressable style={styles.smallBtn} onPress={resetUrl}>
            <Text style={styles.smallBtnText}>Reset</Text>
          </Pressable>
        </View>
        <Text style={styles.hintUrl}>
          Producción: {PRODUCTION_API_URL} (sin /health al final)
        </Text>

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

        <Pressable style={styles.button} onPress={onSubmit} disabled={loading || checking}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </Pressable>

        {!serverOk && !checking ? (
          <View style={styles.help}>
            <Text style={styles.helpTitle}>
              {isExpoGo ? 'Expo Go + HTTPS autofirmado' : 'Conexión al servidor'}
            </Text>
            <Text style={styles.helpText}>
              {isExpoGo ? (
                <>
                  El navegador del celular acepta el certificado;{' '}
                  <Text style={{ fontWeight: '700' }}>Expo Go no</Text>.{'\n\n'}
                  Instala la app nativa (una sola vez en tu Mac):{'\n'}
                  1. bash scripts/prepare-mobile-cert.sh{'\n'}
                  2. cd apps/mobile-expo{'\n'}
                  3. pnpm install{'\n'}
                  4. npx expo prebuild --clean{'\n'}
                  5. npx expo run:android{'\n\n'}
                  Teléfono con USB + depuración. Luego abre la app{' '}
                  <Text style={{ fontWeight: '700' }}>PharmaCol</Text> (no Expo Go).
                </>
              ) : (
                <>
                  1. Pulsa <Text style={{ fontWeight: '700' }}>Producción</Text> →{'\n'}
                  {PRODUCTION_API_URL}{'\n\n'}
                  2. Pulsa <Text style={{ fontWeight: '700' }}>Probar</Text> → verde{'\n\n'}
                  3. Login: admin@pharmacol.co / admin123
                </>
              )}
            </Text>
          </View>
        ) : null}

        {__DEV__ ? (
          <Text style={styles.debug}>Debug: {debugInfo}</Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 16 },
  statusBox: { alignItems: 'center', marginBottom: 12 },
  statusText: { fontSize: 14, fontWeight: '600' },
  statusOk: { color: '#2e7d32' },
  statusFail: { color: '#c62828' },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  hintUrl: { fontSize: 11, color: '#888', marginBottom: 16, textAlign: 'center' },
  smallBtn: {
    flex: 1,
    backgroundColor: '#e8f4f6',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  smallBtnText: { color: '#006874', fontWeight: '600', fontSize: 13 },
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
  help: {
    marginTop: 20,
    backgroundColor: '#fff8e1',
    padding: 12,
    borderRadius: 8,
  },
  helpTitle: { fontWeight: '600', fontSize: 13, marginBottom: 6 },
  helpUrl: { fontSize: 12, color: '#006874', marginBottom: 8 },
  helpText: { fontSize: 12, color: '#666', lineHeight: 18 },
  debug: { marginTop: 16, fontSize: 10, color: '#bbb' },
});
