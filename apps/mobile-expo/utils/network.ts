import * as Network from 'expo-network';

/** Solo verifica conexión Wi‑Fi — NO requiere internet (red local basta) */
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true;
  } catch {
    return true;
  }
}
