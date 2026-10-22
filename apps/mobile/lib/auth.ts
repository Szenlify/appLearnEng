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

type DemoSessionListener = (isDemo: boolean) => void;
let isDemoModeActive = false;
const demoListeners = new Set<DemoSessionListener>();

export function getDemoModeSession(): boolean {
  return isDemoModeActive;
}

export function setDemoModeSession(active: boolean) {
  isDemoModeActive = active;
  demoListeners.forEach((listener) => listener(active));
}

export function subscribeDemoModeSession(listener: DemoSessionListener): () => void {
  demoListeners.add(listener);
  return () => {
    demoListeners.delete(listener);
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

export async function signInWithApple() {
  try {
    const AppleAuthentication = await import('expo-apple-authentication');
    const { supabase } = await import('./supabase');

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
    return null;
  } catch (e: any) {
    if (e.code === 'ERR_REQUEST_CANCELED') {
      // User canceled Apple sign-in prompt
      return null;
    }
    throw e;
  }
}

export async function deleteUserAccount(): Promise<void> {
  const { supabase } = await import('./supabase');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('NOT_AUTHENTICATED');

  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/user/account`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!res.ok) {
    throw new Error('DELETE_ACCOUNT_FAILED');
  }

  // Clear local session and cache
  await supabase.auth.signOut();
}
