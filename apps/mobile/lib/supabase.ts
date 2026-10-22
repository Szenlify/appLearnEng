import { createClient } from '@supabase/supabase-js';
import { createSecureStoreAdapter, type KeyValueStore } from './auth';

const memoryFallback = new Map<string, string>();

const fallbackStore: KeyValueStore = {
  getItemAsync: async (key: string) => {
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
        return globalThis.localStorage.getItem(key);
      }
    } catch {
      // ignore localStorage errors
    }
    return memoryFallback.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => {
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
        globalThis.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // ignore localStorage errors
    }
    memoryFallback.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    try {
      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
        globalThis.localStorage.removeItem(key);
        return;
      }
    } catch {
      // ignore localStorage errors
    }
    memoryFallback.delete(key);
  },
};

function resolveSecureStore(): KeyValueStore {
  try {
    // Load expo-secure-store when running in native Expo runtime
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SecureStore = require('expo-secure-store');
    if (SecureStore && typeof SecureStore.getItemAsync === 'function') {
      return {
        getItemAsync: async (key: string) => {
          try {
            return await SecureStore.getItemAsync(key);
          } catch {
            return fallbackStore.getItemAsync(key);
          }
        },
        setItemAsync: async (key: string, value: string) => {
          try {
            await SecureStore.setItemAsync(key, value);
          } catch {
            await fallbackStore.setItemAsync(key, value);
          }
        },
        deleteItemAsync: async (key: string) => {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch {
            await fallbackStore.deleteItemAsync(key);
          }
        },
      };
    }
  } catch {
    // Fallback to in-memory / localStorage store in non-native or web environments
  }
  return fallbackStore;
}

export const ExpoSecureStoreAdapter = createSecureStoreAdapter(resolveSecureStore());

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
