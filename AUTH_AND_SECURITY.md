# AUTH_AND_SECURITY.md — Authentication & Security Architecture

This document specifies the authentication system and credential security for LearnEng across iOS, Android, and Backend.

---

## 1. Authentication Provider: Supabase Auth (Social Only: Apple & Google)

Aplikacja całkowicie eliminuje tradycyjne logowanie hasłem i e-mailem na rzecz bezhasłowego, natychmiastowego logowania 1-kliknięciem (Social Sign-In):
1. **Sign in with Apple** (`expo-apple-authentication`) — Domyślne, rekomendowane logowanie na iOS (wymóg Apple App Store).
2. **Sign in with Google** — Domyślne, rekomendowane logowanie na Androidzie i alternatywa dla iOS.
3. **Brak haseł i e-maili:** Zero formularzy rejestracyjnych, brak konieczności resetowania haseł, maksymalna konwersja użytkowników (1-tap onboarding).
4. **Zarządzanie sesją:** Tokeny JWT i automatyczne odświeżanie sesji przez Supabase Auth.

---

## 2. Secure Token Storage on Mobile (`expo-secure-store`)

Standard `localStorage` or `AsyncStorage` is vulnerable on rooted/jailbroken devices. All session tokens are stored in hardware-encrypted storage:
- **iOS:** iOS Keychain Services.
- **Android:** Android EncryptedSharedPreferences (KeyStore).

### Supabase Client Setup in Expo (`apps/mobile/lib/supabase.ts`):

```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
```

---

## 3. Apple Sign In Implementation (`expo-apple-authentication`)

On iOS devices, Apple Sign In is rendered as a native branded button:

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';

export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (credential.identityToken) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      return data.user;
    }
  } catch (e: any) {
    if (e.code === 'ERR_REQUEST_CANCELED') {
      // User canceled Apple sign-in prompt
      return null;
    }
    throw e;
  }
}
```

---

## 4. Protected Routes & Session Guard in Expo Router (`apps/mobile/lib/auth.ts` & `apps/mobile/app/_layout.tsx`)

Aby logika `AuthGuard` oraz adaptera `SecureStore` mogła być w 100% przetestowana w `bun test apps/mobile/__tests__/auth.test.ts` (bez konieczności uruchamiania symulatora iOS/Android), w `apps/mobile/lib/auth.ts` eksportujemy czyste funkcje:

```typescript
export interface KeyValueStore {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

export function createSecureStoreAdapter(store: KeyValueStore) {
  return {
    getItem: (key: string) => store.getItemAsync(key),
    setItem: (key: string, value: string) => store.setItemAsync(key, value),
    removeItem: (key: string) => store.deleteItemAsync(key),
  };
}

/**
 * Pure navigation guard decision function:
 * - Unauthenticated user outside (auth) -> redirect to '/(auth)/login'
 * - Authenticated user inside (auth) -> redirect to '/(tabs)'
 * - Otherwise -> null (allow current route)
 */
export function resolveAuthRedirect(
  isAuthenticated: boolean,
  rootSegment?: string
): '/(auth)/login' | '/(tabs)' | null {
  const inAuthGroup = rootSegment === '(auth)';
  if (!isAuthenticated && !inAuthGroup) {
    return '/(auth)/login';
  }
  if (isAuthenticated && inAuthGroup) {
    return '/(tabs)';
  }
  return null;
}
```

In `apps/mobile/app/_layout.tsx`:
- Listen to `supabase.auth.onAuthStateChange`.
- Call `resolveAuthRedirect(Boolean(session), segments[0])` and execute `router.replace(target)` when non-null.
