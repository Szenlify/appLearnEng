import { describe, expect, it } from 'bun:test';
import {
  createSecureStoreAdapter,
  resolveAuthRedirect,
  type KeyValueStore,
} from '../lib/auth';

describe('Stage 5: Supabase Auth SecureStoreAdapter & AuthGuard Redirect Logic', () => {
  describe('1. SecureStoreAdapter (createSecureStoreAdapter)', () => {
    it('securely stores, reads, and removes JWT session tokens via KeyValueStore', async () => {
      const backingStore = new Map<string, string>();
      const mockSecureStore: KeyValueStore = {
        getItemAsync: async (key: string) => backingStore.get(key) ?? null,
        setItemAsync: async (key: string, value: string) => {
          backingStore.set(key, value);
        },
        deleteItemAsync: async (key: string) => {
          backingStore.delete(key);
        },
      };

      const adapter = createSecureStoreAdapter(mockSecureStore);
      const tokenKey = 'sb-learneng-auth-token';
      const jwtPayload = JSON.stringify({
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock',
        refresh_token: 'mock-refresh-token',
      });

      expect(await adapter.getItem(tokenKey)).toBeNull();

      await adapter.setItem(tokenKey, jwtPayload);
      expect(await adapter.getItem(tokenKey)).toBe(jwtPayload);

      await adapter.removeItem(tokenKey);
      expect(await adapter.getItem(tokenKey)).toBeNull();
    });
  });

  describe('2 & 3. AuthGuard Navigation Redirect (resolveAuthRedirect)', () => {
    it('redirects unauthenticated users outside (auth) to /(auth)/login', () => {
      expect(resolveAuthRedirect(false, '(tabs)')).toBe('/(auth)/login');
      expect(resolveAuthRedirect(false, '(modals)')).toBe('/(auth)/login');
      expect(resolveAuthRedirect(false, undefined)).toBe('/(auth)/login');
    });

    it('allows unauthenticated users to stay inside (auth) group without redirect loop', () => {
      expect(resolveAuthRedirect(false, '(auth)')).toBeNull();
    });

    it('redirects authenticated users inside (auth) to /(tabs) and grants access to /(tabs)', () => {
      expect(resolveAuthRedirect(true, '(auth)')).toBe('/(tabs)');
      expect(resolveAuthRedirect(true, '(tabs)')).toBeNull();
      expect(resolveAuthRedirect(true, '(modals)')).toBeNull();
    });
  });
});
