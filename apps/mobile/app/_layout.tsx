import '../global.css';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  getDemoModeSession,
  resolveAuthRedirect,
  subscribeDemoModeSession,
} from '@/lib/auth';
import { FlashcardSyncEngine } from '@/lib/db/FlashcardSyncEngine';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minut
      retry: 2,
    },
  },
});

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [demoMode, setDemoMode] = useState<boolean>(getDemoModeSession());
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const unsubscribeDemo = subscribeDemoModeSession((active) => {
      setDemoMode(active);
      setInitialized(true);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        setSession(initialSession);
        setInitialized(true);
      })
      .catch(() => {
        setInitialized(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setInitialized(true);
    });

    return () => {
      unsubscribeDemo();
      subscription.unsubscribe();
    };
  }, []);

  const isAuthenticated = Boolean(session) || demoMode;

  useEffect(() => {
    if (!initialized) return;
    const redirectTarget = resolveAuthRedirect(isAuthenticated, segments[0]);
    if (redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [initialized, isAuthenticated, segments, router]);

  useEffect(() => {
    const userId = session?.user?.id || (demoMode ? 'local-user' : undefined);
    if (!userId) return;
    let cleanup: (() => void) | undefined;

    FlashcardSyncEngine.init(userId, AppState)
      .then((dispose) => {
        cleanup = dispose;
      })
      .catch(() => {});

    return () => {
      cleanup?.();
    };
  }, [session?.user?.id, demoMode]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <AuthGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0B0F19' },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen
              name="(modals)"
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
                headerShown: false,
              }}
            />
          </Stack>
        </AuthGuard>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
