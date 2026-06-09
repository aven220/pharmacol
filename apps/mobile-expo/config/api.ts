import Constants from 'expo-constants';

export function normalizeApiUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, '');
  url = url.replace(/\/health$/i, '');

  try {
    const withProto = url.match(/^https?:\/\//i) ? url : `https://${url}`;
    const parsed = new URL(withProto);
    if (parsed.hostname === '20.5.19.8' && !parsed.pathname.includes('/pharmacol')) {
      parsed.pathname = '/pharmacol/v1';
    }
    url = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
  } catch {
    // mantener url tal cual
  }

  if (!url.endsWith('/v1')) {
    url = `${url}/v1`;
  }
  return url;
}

/** URL fija embebida en la APK (build time) */
export const PRODUCTION_API_URL = normalizeApiUrl(
  process.env.EXPO_PUBLIC_API_URL?.trim() || 'https://20.5.19.8/pharmacol/v1',
);

function resolveBuildApiUrl(): string {
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromExtra) return normalizeApiUrl(fromExtra);
  if (fromEnv) return normalizeApiUrl(fromEnv);
  return PRODUCTION_API_URL;
}

/** URL de la API — fija en la APK (build time) */
export function getApiUrl(): string {
  return resolveBuildApiUrl();
}
