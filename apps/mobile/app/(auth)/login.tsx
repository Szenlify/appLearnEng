import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AppleLogo, PlayCircle } from 'phosphor-react-native';
import { setDemoModeSession, signInWithApple } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

try {
  WebBrowser.maybeCompleteAuthSession();
} catch {
  // Ignore in non-browser/test environments
}

export default function LoginScreen() {
  const router = useRouter();

  const handleAppleLogin = async () => {
    try {
      await signInWithApple();
    } catch (err) {
      console.warn('Apple Sign In failed:', err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const redirectTo = 'learneng://auth/callback';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (res.type === 'success' && res.url) {
          const params = new URLSearchParams(res.url.split('#')[1] || res.url.split('?')[1]);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
          }
        }
      }
    } catch (err) {
      console.warn('Google Sign In failed:', err);
    }
  };

  const handleDemoLogin = () => {
    setDemoModeSession(true);
    router.replace('/(tabs)');
  };

  return (
    <View className="flex-1 bg-[#0B0F19] justify-between py-16 px-6">
      {/* 1. Hero & Branding */}
      <View className="items-center mt-12">
        <View className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/40 items-center justify-center mb-6">
          <PlayCircle size={44} color="#6366F1" weight="fill" />
        </View>
        <Text className="text-3xl font-extrabold text-white text-center tracking-tight mb-2">
          LearnEng
        </Text>
        <Text className="text-slate-400 text-center text-sm px-6 leading-relaxed">
          Learn English from authentic YouTube videos with instant AI translations and spaced repetition flashcards.
        </Text>
      </View>

      {/* 2. Social Sign-In Buttons: Apple, Google & Guest Demo */}
      <View className="w-full space-y-3">
        {Platform.OS === 'ios' && (
          <Pressable
            onPress={handleAppleLogin}
            className="w-full h-[52px] bg-white rounded-2xl flex-row items-center justify-center space-x-2 active:opacity-90 shadow-lg"
          >
            <AppleLogo size={20} color="#0F172A" weight="fill" />
            <Text className="text-slate-900 font-semibold text-base ml-2">Sign in with Apple</Text>
          </Pressable>
        )}

        <Pressable
          onPress={handleGoogleLogin}
          className="w-full h-[52px] bg-white rounded-2xl flex-row items-center justify-center space-x-3 active:opacity-90 shadow-lg mt-3"
        >
          <Text className="text-slate-900 font-semibold text-base">Continue with Google</Text>
        </Pressable>

        <Pressable
          onPress={handleDemoLogin}
          className="w-full h-[48px] bg-slate-800/80 border border-slate-700 rounded-2xl flex-row items-center justify-center active:opacity-80 mt-3"
        >
          <Text className="text-sky-400 font-semibold text-sm">Continue as Guest (Demo Mode)</Text>
        </Pressable>

        <Text className="text-slate-500 text-[11px] text-center mt-4 px-4 leading-normal">
          One-tap sign in. No passwords. By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}
