import React, { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ access_token?: string; refresh_token?: string }>();

  useEffect(() => {
    async function finalizeOAuth() {
      try {
        if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: String(params.access_token),
            refresh_token: String(params.refresh_token),
          });
          router.replace('/(tabs)');
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(auth)/login');
        }
      } catch {
        router.replace('/(auth)/login');
      }
    }

    finalizeOAuth();
  }, [params.access_token, params.refresh_token, router]);

  return (
    <View className="flex-1 bg-[#0B0F19] items-center justify-center">
      <ActivityIndicator size="large" color="#38BDF8" />
      <Text className="text-slate-400 text-sm mt-4">Signing you in...</Text>
    </View>
  );
}
