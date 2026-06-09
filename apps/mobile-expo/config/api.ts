import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const OVERRIDE_KEY = 'pharmacol_api_url';

export function normalizeApiUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  url = url.replace(/\/health$/i, '');

  // Corregir URL de producción sin subpath /pharmacol
  try {
    const withProto = url.match(/^https?:\/\//i) ? url : `https://${url}`;
    const parsed = new URL(withProto);
    if (
      parsed.hostname === '20.5.19.8' &&
      !parsed.pathname.includes('/pharmacol')
    ) {
      parsed.pathname = '/pharmacol/v1';
      url = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
    } else {
      url = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
    }
  } catch {
    // mantener url tal cual si no es URL válida
  }

  if (!url.endsWith('/v1')) {
    url = `${url}/v1`;
  }
  return url;
}

/** URL pública del servidor de producción */
export const PRODUCTION_API_URL = normalizeApiUrl(
  process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://20.5.19.8/pharmacol/v1',
);

/** IP del Mac donde corre Metro — Expo Go la expone automáticamente */
export function getExpoDevHost(): string | null {
  const expoConfig = Constants.expoConfig as
    | { hostUri?: string; debuggerHost?: string }
    | undefined;
  const expoGo = Constants.expoGoConfig as { debuggerHost?: string } | undefined;

  const raw =
    expoConfig?.debuggerHost ??
    expoGo?.debuggerHost ??
    expoConfig?.hostUri ??
    Constants.linkingUri;

  if (!raw) return null;

  const host = raw.replace(/^https?:\/\//, '').split(':')[0]?.split('/')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  return host;
}

export function getExpoDebugInfo(): string {
  const expoConfig = Constants.expoConfig as unknown as Record<string, unknown> | undefined;
  const expoGo = Constants.expoGoConfig as unknown as Record<string, unknown> | undefined;
  return JSON.stringify(
    {
      debuggerHost: expoConfig?.debuggerHost ?? expoGo?.debuggerHost,
      hostUri: expoConfig?.hostUri,
      expoHost: getExpoDevHost(),
    },
    null,
    0,
  );
}

let cachedOverride: string | null | undefined;

export async function getApiUrlOverride(): Promise<string | null> {
  if (cachedOverride !== undefined) return cachedOverride;
  try {
    const raw = await SecureStore.getItemAsync(OVERRIDE_KEY);
    if (!raw) {
      cachedOverride = null;
      return null;
    }
    const normalized = normalizeApiUrl(raw);
    // Overrides locales no sirven fuera del servidor
    if (/127\.0\.0\.1|localhost/i.test(normalized) && !__DEV__) {
      cachedOverride = null;
      await SecureStore.deleteItemAsync(OVERRIDE_KEY);
      return null;
    }
    cachedOverride = normalized;
  } catch {
    cachedOverride = null;
  }
  return cachedOverride;
}

export async function setApiUrlOverride(url: string | null): Promise<void> {
  if (url) {
    const normalized = normalizeApiUrl(url);
    cachedOverride = normalized;
    await SecureStore.setItemAsync(OVERRIDE_KEY, normalized);
  } else {
    cachedOverride = null;
    await SecureStore.deleteItemAsync(OVERRIDE_KEY);
  }
}

export function resolveApiUrlSync(): string {
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (fromExtra) return normalizeApiUrl(fromExtra);
  if (fromEnv) return normalizeApiUrl(fromEnv);

  const expoHost = getExpoDevHost();
  if (__DEV__ && expoHost) {
    return normalizeApiUrl(`http://${expoHost}:3005`);
  }

  if (__DEV__) return normalizeApiUrl('http://localhost:3005');
  return PRODUCTION_API_URL;
}

export async function getApiUrl(): Promise<string> {
  const override = await getApiUrlOverride();
  if (override) return override;
  return resolveApiUrlSync();
}

export const API_URL_HINT = resolveApiUrlSync();
