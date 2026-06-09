import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import type { AuthTokens, UserProfile } from '@/types';
import { clearSearchCache } from '@/storage/search-cache';

const ACCESS = 'pharmacol_access';
const REFRESH = 'pharmacol_refresh';
const USER = 'pharmacol_user';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  setSession: (user: UserProfile, tokens: AuthTokens) => Promise<void>;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  setUser: (user: UserProfile) => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: true,

  setSession: async (user, tokens) => {
    await SecureStore.setItemAsync(ACCESS, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH, tokens.refreshToken);
    await SecureStore.setItemAsync(USER, JSON.stringify(user));
    set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },

  setTokens: async (tokens) => {
    await SecureStore.setItemAsync(ACCESS, tokens.accessToken);
    await SecureStore.setItemAsync(REFRESH, tokens.refreshToken);
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },

  setUser: async (user) => {
    await SecureStore.setItemAsync(USER, JSON.stringify(user));
    set({ user });
  },

  loadStoredAuth: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(ACCESS);
      const refreshToken = await SecureStore.getItemAsync(REFRESH);
      const userJson = await SecureStore.getItemAsync(USER);
      set({
        accessToken,
        refreshToken,
        user: userJson ? (JSON.parse(userJson) as UserProfile) : null,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await clearSearchCache();
    await SecureStore.deleteItemAsync(ACCESS);
    await SecureStore.deleteItemAsync(REFRESH);
    await SecureStore.deleteItemAsync(USER);
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
